import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../drizzle/schema";
import {
  type InsertDeposit,
  type InsertMatch,
  type InsertReferral,
  type InsertTransaction,
  type InsertUser,
  type InsertWithdrawal,
  deposits,
  matchCategories,
  matchModes,
  matchParticipants,
  matches,
  referrals,
  transactions,
  users,
  wallets,
  withdrawals,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { calculateTournamentAwards } from "./tournamentPayouts";
import { allocateEntryFee } from "./tournamentWalletRules";

let pool: Pool | null = null;
let database: NodePgDatabase<typeof schema> | null = null;
type WorkflowDatabase = NodePgDatabase<typeof schema>;

export async function getDb() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) return null;

  if (!database) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: true },
      max: 5,
    });
    database = drizzle(pool, { schema });
  }
  return database;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  return db;
}

async function withinWorkflowTransaction<T>(
  databaseOverride: WorkflowDatabase | undefined,
  operation: (tx: WorkflowDatabase) => Promise<T>,
): Promise<T> {
  if (databaseOverride) return operation(databaseOverride);
  const db = await requireDb();
  return db.transaction((tx) => operation(tx as unknown as WorkflowDatabase));
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");

  const designatedAdminEmail = "rosidulshah4@gmail.com";
  const shouldBeAdmin = user.role === "admin"
    || user.openId === ENV.ownerOpenId
    || user.email?.toLowerCase() === designatedAdminEmail;
  const role = shouldBeAdmin ? "admin" : (user.role ?? "user");
  const lastSignedIn = user.lastSignedIn ?? new Date();

  // A manually provisioned account may have been created before its first OAuth
  // login. Reuse that account (and its wallet) when OAuth supplies the same email.
  const normalizedEmail = user.email?.trim().toLowerCase();
  if (normalizedEmail) {
    const [existingByEmail] = await db.select().from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (existingByEmail && existingByEmail.openId !== user.openId) {
      await db.update(users).set({
        openId: user.openId,
        name: user.name ?? existingByEmail.name,
        email: user.email,
        loginMethod: user.loginMethod ?? existingByEmail.loginMethod,
        role: shouldBeAdmin ? "admin" : existingByEmail.role,
        lastSignedIn,
        updatedAt: new Date(),
      }).where(eq(users.id, existingByEmail.id));
      return;
    }
  }

  await db.insert(users).values({
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    role,
    lastSignedIn,
  }).onConflictDoUpdate({
    target: users.openId,
    set: {
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: shouldBeAdmin ? "admin" : sql`${users.role}`,
      lastSignedIn,
      updatedAt: new Date(),
    },
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function getPlayerProfile(userId: number, databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Player account not found");

  const [stats] = await db.select({
    totalMatches: sql<number>`COUNT(*)::int`,
    totalKills: sql<number>`COALESCE(SUM(${matchParticipants.killCount}), 0)::int`,
    totalEarnings: sql<string>`COALESCE(SUM(${matchParticipants.prizeAwarded}), 0)::text`,
  }).from(matchParticipants).where(eq(matchParticipants.userId, userId));

  const [latestMatchIdentity] = await db.select({
    ign: matchParticipants.freeFireIGN,
    uid: matchParticipants.freeFireUID,
  }).from(matchParticipants)
    .where(eq(matchParticipants.userId, userId))
    .orderBy(desc(matchParticipants.createdAt))
    .limit(1);

  return {
    user,
    freeFireName: user.freeFireName ?? latestMatchIdentity?.ign ?? null,
    freeFireUid: user.freeFireUid ?? latestMatchIdentity?.uid ?? null,
    totalMatches: stats?.totalMatches ?? 0,
    totalKills: stats?.totalKills ?? 0,
    totalEarnings: stats?.totalEarnings ?? "0",
  };
}

export async function updatePlayerProfile(
  userId: number,
  input: { freeFireName: string; freeFireUid: string },
  databaseOverride?: WorkflowDatabase,
) {
  const db = databaseOverride ?? await requireDb();
  await db.update(users).set({
    freeFireName: input.freeFireName,
    freeFireUid: input.freeFireUid,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
  return getPlayerProfile(userId, db);
}

export async function createWallet(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.insert(wallets).values({ userId, depositBalance: "0", winningBalance: "0", bonusBalance: "0" })
    .onConflictDoNothing({ target: wallets.userId });
}

export async function getWallet(userId: number, databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  const result = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return result[0];
}

export async function updateWalletBalance(
  userId: number,
  balanceType: "depositBalance" | "winningBalance" | "bonusBalance",
  amount: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) throw new Error("Invalid wallet adjustment amount");

  const column = wallets[balanceType];
  const result = await db.update(wallets)
    .set({ [balanceType]: sql`${column} + ${numericAmount}` })
    .where(and(eq(wallets.userId, userId), gte(column, sql`${-numericAmount}`)))
    .returning({ id: wallets.id });
  if (result.length === 0) throw new Error("Wallet not found or insufficient balance");
}

export async function initializeMatchCategories(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.insert(matchCategories).values([
    { name: "BR", description: "Battle Royale" },
    { name: "CS", description: "Clash Squad" },
    { name: "Lone Wolf", description: "Lone Wolf" },
  ]).onConflictDoUpdate({ target: matchCategories.name, set: { description: sql`excluded."description"` } });
}

export async function initializeMatchModes(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  const categories = await db.select().from(matchCategories);
  const categoryId = (name: string) => categories.find((category) => category.name === name)?.id;
  const br = categoryId("BR");
  const cs = categoryId("CS");
  const loneWolf = categoryId("Lone Wolf");
  if (!br || !cs || !loneWolf) throw new Error("Match categories were not initialized");

  const definitions = [
    { categoryId: br, name: "Solo", teamSize: 1, maxPlayers: 100, entryFee: "100" },
    { categoryId: br, name: "Duo", teamSize: 2, maxPlayers: 100, entryFee: "150" },
    { categoryId: br, name: "Squad", teamSize: 4, maxPlayers: 100, entryFee: "200" },
    { categoryId: cs, name: "1v1", teamSize: 1, maxPlayers: 2, entryFee: "80" },
    { categoryId: cs, name: "2v2", teamSize: 2, maxPlayers: 4, entryFee: "120" },
    { categoryId: cs, name: "4v4", teamSize: 4, maxPlayers: 8, entryFee: "180" },
    { categoryId: loneWolf, name: "1v1", teamSize: 1, maxPlayers: 2, entryFee: "50" },
    { categoryId: loneWolf, name: "2v2", teamSize: 2, maxPlayers: 4, entryFee: "75" },
    { categoryId: loneWolf, name: "4v4", teamSize: 4, maxPlayers: 8, entryFee: "100" },
  ];

  for (const mode of definitions) {
    await db.insert(matchModes).values(mode).onConflictDoUpdate({
      target: [matchModes.categoryId, matchModes.name],
      set: { teamSize: mode.teamSize, maxPlayers: mode.maxPlayers, entryFee: mode.entryFee },
    });
  }
}

export async function getMatchCategories() {
  const db = await requireDb();
  return db.select().from(matchCategories);
}

export async function getMatchModesByCategory(categoryId: number) {
  const db = await requireDb();
  return db.select().from(matchModes).where(eq(matchModes.categoryId, categoryId));
}

export async function createMatch(match: InsertMatch): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  const result = await db.insert(matches).values(match).returning({ id: matches.id });
  return result[0]!.id;
}

export async function getUpcomingMatches(categoryId: number, modeId?: number, _hoursAhead?: number) {
  const db = await requireDb();
  const now = new Date();
  await db.update(matches).set({ status: "expired" })
    .where(and(eq(matches.status, "scheduled"), lt(matches.scheduledStartTime, now)));

  const conditions = [
    eq(matches.categoryId, categoryId),
    gte(matches.scheduledStartTime, now),
    eq(matches.status, "scheduled"),
  ];
  if (modeId) conditions.push(eq(matches.modeId, modeId));
  return db.select({
    match: {
      id: matches.id,
      categoryId: matches.categoryId,
      modeId: matches.modeId,
      matchTitle: matches.matchTitle,
      mapName: matches.mapName,
      scheduledStartTime: matches.scheduledStartTime,
      scheduledEndTime: matches.scheduledEndTime,
      status: matches.status,
      entryFee: matches.entryFee,
      totalSlots: matches.totalSlots,
      totalPrizePool: matches.totalPrizePool,
      perKillReward: matches.perKillReward,
      adminProfitDeducted: matches.adminProfitDeducted,
      currentPlayers: matches.currentPlayers,
      minPlayersRequired: matches.minPlayersRequired,
      createdAt: matches.createdAt,
      updatedAt: matches.updatedAt,
    },
    mode: matchModes,
    category: matchCategories,
  })
    .from(matches)
    .innerJoin(matchModes, eq(matches.modeId, matchModes.id))
    .innerJoin(matchCategories, eq(matches.categoryId, matchCategories.id))
    .where(and(...conditions))
    .orderBy(matches.scheduledStartTime);
}

export async function getMatchById(matchId: number) {
  const db = await requireDb();
  const result = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  return result[0];
}

export async function getPublicMatchById(matchId: number, databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  const result = await db.select({
    match: {
      id: matches.id,
      matchTitle: matches.matchTitle,
      mapName: matches.mapName,
      scheduledStartTime: matches.scheduledStartTime,
      scheduledEndTime: matches.scheduledEndTime,
      status: matches.status,
      entryFee: matches.entryFee,
      totalSlots: matches.totalSlots,
      totalPrizePool: matches.totalPrizePool,
      perKillReward: matches.perKillReward,
      currentPlayers: matches.currentPlayers,
      minPlayersRequired: matches.minPlayersRequired,
    },
    category: { id: matchCategories.id, name: matchCategories.name, description: matchCategories.description },
    mode: { id: matchModes.id, name: matchModes.name, teamSize: matchModes.teamSize, maxPlayers: matchModes.maxPlayers },
  }).from(matches)
    .innerJoin(matchCategories, eq(matches.categoryId, matchCategories.id))
    .innerJoin(matchModes, eq(matches.modeId, matchModes.id))
    .where(eq(matches.id, matchId))
    .limit(1);
  return result[0];
}

export async function getRoomCredentialsForJoinedPlayer(matchId: number, userId: number, databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  const participant = await db.select({ id: matchParticipants.id })
    .from(matchParticipants)
    .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId)))
    .limit(1);
  if (participant.length === 0) throw new Error("Join this match to access room details");

  const rows = await db.select({
    roomId: matches.roomId,
    roomPassword: matches.roomPassword,
    credentialsVisibleAt: matches.credentialsVisibleAt,
  }).from(matches).where(eq(matches.id, matchId)).limit(1);
  const match = rows[0];
  if (!match) throw new Error("Match not found");
  if (!match.credentialsVisibleAt || match.credentialsVisibleAt > new Date() || !match.roomId || !match.roomPassword) {
    return { available: false, visibleAt: match.credentialsVisibleAt };
  }
  return { available: true, visibleAt: match.credentialsVisibleAt, roomId: match.roomId, roomPassword: match.roomPassword };
}

export async function updateMatch(matchId: number, updates: Partial<InsertMatch>) {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.update(matches).set({ ...updates, updatedAt: new Date() }).where(eq(matches.id, matchId));
}

export async function joinMatch(
  matchId: number,
  userId: number,
  freeFireIGN: string,
  freeFireUID: string,
  databaseOverride?: WorkflowDatabase,
) {
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    const matchRows = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
    const match = matchRows[0];
    if (!match) throw new Error("Match not found");
    if (match.status !== "scheduled" || match.scheduledStartTime <= new Date()) {
      throw new Error("Match is not accepting players");
    }
    if (match.currentPlayers >= match.totalSlots) throw new Error("Match is full");

    const duplicate = await tx.select({ id: matchParticipants.id }).from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId))).limit(1);
    if (duplicate.length > 0) throw new Error("You have already joined this match");

    await tx.insert(wallets).values({ userId, depositBalance: "0", winningBalance: "0", bonusBalance: "0" })
      .onConflictDoNothing({ target: wallets.userId });
    const walletRows = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1).for("update");
    const wallet = walletRows[0];
    if (!wallet) throw new Error("Player wallet not found");

    const entryFee = Number(match.entryFee);
    const { deductedFromDeposit, deductedFromBonus } = allocateEntryFee(
      entryFee,
      Number(wallet.depositBalance),
      Number(wallet.bonusBalance),
    );
    if (deductedFromDeposit > 0) {
      await tx.update(wallets).set({ depositBalance: sql`${wallets.depositBalance} - ${deductedFromDeposit}` })
        .where(eq(wallets.userId, userId));
    }
    if (deductedFromBonus > 0) {
      await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} - ${deductedFromBonus}` })
        .where(eq(wallets.userId, userId));
    }

    const participantRows = await tx.insert(matchParticipants).values({
      matchId, userId, entryFeeDeducted: entryFee.toFixed(2), freeFireIGN, freeFireUID, status: "joined",
    }).returning({ id: matchParticipants.id });
    const participantId = participantRows[0]!.id;

    await tx.update(matches).set({ currentPlayers: sql`${matches.currentPlayers} + 1`, updatedAt: new Date() })
      .where(eq(matches.id, matchId));

    const transactionsToCreate = [];
    if (deductedFromDeposit > 0) transactionsToCreate.push({
      userId, type: "match_entry" as const, amount: (-deductedFromDeposit).toFixed(2), balanceType: "deposit" as const,
      matchId, status: "completed" as const, description: `Match entry fee deducted from Deposit balance for match ${matchId}`,
    });
    if (deductedFromBonus > 0) transactionsToCreate.push({
      userId, type: "match_entry" as const, amount: (-deductedFromBonus).toFixed(2), balanceType: "bonus" as const,
      matchId, status: "completed" as const, description: `Match entry fee deducted from Bonus balance for match ${matchId}`,
    });
    if (transactionsToCreate.length > 0) await tx.insert(transactions).values(transactionsToCreate);

    return { participantId, matchId, deductedFromDeposit, deductedFromBonus };
  });
}

export async function getMatchParticipants(matchId: number) {
  const db = await requireDb();
  return db.select().from(matchParticipants).where(eq(matchParticipants.matchId, matchId));
}

export async function getPlayerMatches(userId: number) {
  const db = await requireDb();
  return db.select().from(matchParticipants).where(eq(matchParticipants.userId, userId));
}

export async function updateParticipantResult(participantId: number, killCount: number, rank: number, prizeAwarded: string) {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.update(matchParticipants).set({ killCount, rank, prizeAwarded, status: "completed", updatedAt: new Date() })
    .where(eq(matchParticipants.id, participantId));
}

export async function submitParticipantResultAndSettle(participantId: number, killCount: number, rank: number) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const participantRows = await tx.select().from(matchParticipants)
      .where(eq(matchParticipants.id, participantId)).limit(1).for("update");
    const participant = participantRows[0];
    if (!participant) throw new Error("Participant not found");
    if (participant.status === "completed") throw new Error("This participant's result has already been settled");

    const matchRows = await tx.select({ match: matches, category: matchCategories })
      .from(matches).innerJoin(matchCategories, eq(matches.categoryId, matchCategories.id))
      .where(eq(matches.id, participant.matchId)).limit(1).for("update");
    const matchData = matchRows[0];
    if (!matchData) throw new Error("Match not found");
    if (["cancelled", "expired"].includes(matchData.match.status)) throw new Error("This match cannot be settled");

    await tx.update(matchParticipants).set({ killCount, rank, status: "confirmed", updatedAt: new Date() })
      .where(eq(matchParticipants.id, participantId));

    const participants = await tx.select().from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchData.match.id)).for("update");
    const pendingResults = participants.filter((entry) => entry.id !== participantId && (entry.killCount === null || entry.rank === null));
    if (pendingResults.length > 0) return { settled: false, pendingResults: pendingResults.length };

    const finalParticipants = participants.map((entry) => entry.id === participantId ? { ...entry, killCount, rank } : entry);
    const settlement = calculateTournamentAwards({
      categoryName: matchData.category.name,
      entryFee: Number(matchData.match.entryFee),
      currentPlayers: matchData.match.currentPlayers,
      perKillReward: Number(matchData.match.perKillReward),
      participants: finalParticipants,
    });

    for (const award of settlement.awards) {
      const { killReward, rankPrize, totalAward } = award;
      if (totalAward > 0) {
        await tx.update(wallets).set({ winningBalance: sql`${wallets.winningBalance} + ${totalAward}` })
          .where(eq(wallets.userId, award.userId));
      }
      if (killReward > 0) await tx.insert(transactions).values({
        userId: award.userId, type: "kill_reward", amount: killReward.toFixed(2), balanceType: "winning",
        matchId: matchData.match.id, status: "completed", description: `${award.killCount} kills × ${Number(matchData.match.perKillReward).toFixed(2)} Coins`,
      });
      if (rankPrize > 0) await tx.insert(transactions).values({
        userId: award.userId, type: "prize_win", amount: rankPrize.toFixed(2), balanceType: "winning",
        matchId: matchData.match.id, status: "completed",
        description: matchData.category.name === "BR" ? `BR rank ${award.rank} prize` : "Match winner prize",
      });
      await tx.update(matchParticipants).set({ prizeAwarded: totalAward.toFixed(2), status: "completed", updatedAt: new Date() })
        .where(eq(matchParticipants.id, award.id));
    }

    await tx.update(matches).set({
      status: "completed", totalPrizePool: settlement.netPrizePool.toFixed(2), adminProfitDeducted: settlement.adminProfit.toFixed(2), updatedAt: new Date(),
    }).where(eq(matches.id, matchData.match.id));

    return { settled: true, pendingResults: 0, matchId: matchData.match.id, netPrizePool: settlement.netPrizePool, adminProfit: settlement.adminProfit };
  });
}

export async function createTransaction(transaction: InsertTransaction): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  const result = await db.insert(transactions).values(transaction).returning({ id: transactions.id });
  return result[0]!.id;
}

export async function getUserTransactions(userId: number) {
  const db = await requireDb();
  return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
}

export async function createDeposit(deposit: InsertDeposit): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  const result = await db.insert(deposits).values(deposit).returning({ id: deposits.id });
  return result[0]!.id;
}

export async function getPendingDeposits() {
  const db = await requireDb();
  return db.select().from(deposits).where(eq(deposits.status, "pending")).orderBy(deposits.createdAt);
}

export async function updateDepositStatus(depositId: number, status: "pending" | "approved" | "rejected", rejectionReason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.update(deposits).set({ status, rejectionReason: rejectionReason ?? null, updatedAt: new Date() }).where(eq(deposits.id, depositId));
}

export async function createWithdrawal(withdrawal: InsertWithdrawal): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  const result = await db.insert(withdrawals).values(withdrawal).returning({ id: withdrawals.id });
  return result[0]!.id;
}

export async function requestWithdrawal(
  userId: number,
  amount: number,
  payoutMethod: "upi" | "google_play",
  payoutDetails: string,
  databaseOverride?: WorkflowDatabase,
) {
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    await tx.insert(wallets).values({ userId, depositBalance: "0", winningBalance: "0", bonusBalance: "0" })
      .onConflictDoNothing({ target: wallets.userId });
    const walletRows = await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1).for("update");
    const wallet = walletRows[0];
    if (!wallet || Number(wallet.winningBalance) < amount) throw new Error("Insufficient winning balance");

    const withdrawalRows = await tx.insert(withdrawals).values({
      userId,
      amount: amount.toFixed(2),
      payoutMethod,
      payoutDetails,
      status: "pending",
    }).returning({ id: withdrawals.id });
    const withdrawalId = withdrawalRows[0]!.id;
    await tx.update(wallets).set({ winningBalance: sql`${wallets.winningBalance} - ${amount}` })
      .where(eq(wallets.userId, userId));
    await tx.insert(transactions).values({
      userId,
      type: "withdrawal",
      amount: (-amount).toFixed(2),
      balanceType: "winning",
      withdrawalId,
      status: "pending",
      description: `Withdrawal request queued via ${payoutMethod}`,
    });
    return { withdrawalId };
  });
}

export async function getPendingWithdrawals() {
  const db = await requireDb();
  return db.select().from(withdrawals).where(eq(withdrawals.status, "pending")).orderBy(withdrawals.createdAt);
}

export async function updateWithdrawalStatus(depositId: number, status: "pending" | "approved" | "rejected" | "completed", rejectionReason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.update(withdrawals).set({ status, rejectionReason: rejectionReason ?? null, updatedAt: new Date() }).where(eq(withdrawals.id, depositId));
}

export async function processWithdrawalRequest(
  withdrawalId: number,
  action: "completed" | "rejected",
  rejectionReason?: string,
  databaseOverride?: WorkflowDatabase,
) {
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    const rows = await tx.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).limit(1).for("update");
    const withdrawal = rows[0];
    if (!withdrawal) throw new Error("Withdrawal request not found");
    if (withdrawal.status !== "pending") throw new Error("This withdrawal request has already been processed");

    if (action === "rejected") {
      await tx.update(wallets).set({ winningBalance: sql`${wallets.winningBalance} + ${Number(withdrawal.amount)}` })
        .where(eq(wallets.userId, withdrawal.userId));
      await tx.insert(transactions).values({
        userId: withdrawal.userId,
        type: "withdrawal",
        amount: Number(withdrawal.amount).toFixed(2),
        balanceType: "winning",
        withdrawalId,
        status: "cancelled",
        description: `Withdrawal rejected and refunded${rejectionReason ? `: ${rejectionReason}` : ""}`,
      });
    }

    await tx.update(withdrawals).set({
      status: action,
      rejectionReason: action === "rejected" ? (rejectionReason ?? "Rejected by administrator") : null,
      updatedAt: new Date(),
    }).where(eq(withdrawals.id, withdrawalId));
    return { withdrawalId, status: action };
  });
}

export async function createReferral(referral: InsertReferral): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  const result = await db.insert(referrals).values(referral).returning({ id: referrals.id });
  return result[0]!.id;
}

export async function getReferralByCode(referralCode: string) {
  const db = await requireDb();
  const result = await db.select().from(referrals).where(eq(referrals.referralCode, referralCode)).limit(1);
  return result[0];
}

export async function isBanned(userId: number): Promise<boolean> {
  const user = await getUserById(userId);
  return Boolean(user?.isBanned);
}

export async function banUser(userId: number, reason: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.update(users).set({ isBanned: true, banReason: reason, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function getAllUsersWithWallets() {
  const db = await requireDb();
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    depositBalance: wallets.depositBalance,
    winningBalance: wallets.winningBalance,
    bonusBalance: wallets.bonusBalance,
    createdAt: users.createdAt,
  }).from(users).leftJoin(wallets, eq(users.id, wallets.userId)).orderBy(desc(users.createdAt));
}

export async function adjustUserBalance(
  userId: number,
  balanceType: "depositBalance" | "winningBalance" | "bonusBalance",
  amount: string,
  description: string,
): Promise<void> {
  await updateWalletBalance(userId, balanceType, amount);
  const balanceTypeMap = { depositBalance: "deposit", winningBalance: "winning", bonusBalance: "bonus" } as const;
  await createTransaction({
    userId,
    type: "admin_adjustment",
    amount,
    balanceType: balanceTypeMap[balanceType],
    status: "completed",
    description,
  });
}
