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

let pool: Pool | null = null;
let database: NodePgDatabase<typeof schema> | null = null;

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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");

  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  const lastSignedIn = user.lastSignedIn ?? new Date();
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
      role,
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

export async function createWallet(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.insert(wallets).values({ userId, depositBalance: "0", winningBalance: "0", bonusBalance: "0" })
    .onConflictDoNothing({ target: wallets.userId });
}

export async function getWallet(userId: number) {
  const db = await requireDb();
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
  return db.select({ match: matches, mode: matchModes, category: matchCategories })
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

export async function updateMatch(matchId: number, updates: Partial<InsertMatch>) {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.update(matches).set({ ...updates, updatedAt: new Date() }).where(eq(matches.id, matchId));
}

export async function joinMatch(matchId: number, userId: number, entryFeeDeducted: string, freeFireIGN?: string, freeFireUID?: string) {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.transaction(async (tx) => {
    await tx.insert(matchParticipants).values({
      matchId, userId, entryFeeDeducted, freeFireIGN: freeFireIGN ?? null, freeFireUID: freeFireUID ?? null, status: "joined",
    });
    const changed = await tx.update(matches).set({ currentPlayers: sql`${matches.currentPlayers} + 1` })
      .where(and(eq(matches.id, matchId), sql`${matches.currentPlayers} < ${matches.totalSlots}`))
      .returning({ id: matches.id });
    if (changed.length === 0) throw new Error("Match is full");
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

export async function getPendingWithdrawals() {
  const db = await requireDb();
  return db.select().from(withdrawals).where(eq(withdrawals.status, "pending")).orderBy(withdrawals.createdAt);
}

export async function updateWithdrawalStatus(depositId: number, status: "pending" | "approved" | "rejected" | "completed", rejectionReason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Neon database is not configured");
  await db.update(withdrawals).set({ status, rejectionReason: rejectionReason ?? null, updatedAt: new Date() }).where(eq(withdrawals.id, depositId));
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
