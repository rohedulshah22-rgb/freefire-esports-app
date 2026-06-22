import { eq, and, desc, gte, lte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  wallets,
  InsertWallet,
  matches,
  InsertMatch,
  matchModes,
  matchCategories,
  matchParticipants,
  InsertMatchParticipant,
  transactions,
  InsertTransaction,
  deposits,
  InsertDeposit,
  withdrawals,
  InsertWithdrawal,
  referrals,
  InsertReferral,
  bannedAccounts,
  InsertBannedAccount,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * USER OPERATIONS
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * WALLET OPERATIONS
 */
export async function createWallet(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(wallets).values({
    userId,
    depositBalance: "0",
    winningBalance: "0",
    bonusBalance: "0",
  });
}

export async function getWallet(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateWalletBalance(
  userId: number,
  balanceType: "depositBalance" | "winningBalance" | "bonusBalance",
  amount: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const wallet = await getWallet(userId);
  if (!wallet) throw new Error("Wallet not found");

  const currentAmount = parseFloat(wallet[balanceType] as any);
  const newAmount = (currentAmount + parseFloat(amount)).toFixed(2);

  await db
    .update(wallets)
    .set({ [balanceType]: newAmount })
    .where(eq(wallets.userId, userId));
}

/**
 * MATCH OPERATIONS
 */
export async function initializeMatchCategories(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(matchCategories);
  if (existing.length > 0) return; // Already initialized

  await db.insert(matchCategories).values([
    { name: "BR", description: "Battle Royale" },
    { name: "CS", description: "Clash Squad" },
    { name: "Lone Wolf", description: "Lone Wolf" },
  ]);
}

export async function initializeMatchModes(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(matchModes);
  if (existing.length > 0) return; // Already initialized

  // Get category IDs
  const categories = await db.select().from(matchCategories);
  const brCat = categories.find((c) => c.name === "BR");
  const csCat = categories.find((c) => c.name === "CS");
  const lwCat = categories.find((c) => c.name === "Lone Wolf");

  if (!brCat || !csCat || !lwCat) throw new Error("Categories not found");

  await db.insert(matchModes).values([
    // BR modes
    { categoryId: brCat.id, name: "1v1", teamSize: 1, maxPlayers: 2, entryFee: "100" },
    { categoryId: brCat.id, name: "2v2", teamSize: 2, maxPlayers: 4, entryFee: "150" },
    { categoryId: brCat.id, name: "4v4", teamSize: 4, maxPlayers: 8, entryFee: "200" },
    // CS modes
    { categoryId: csCat.id, name: "1v1", teamSize: 1, maxPlayers: 2, entryFee: "80" },
    { categoryId: csCat.id, name: "2v2", teamSize: 2, maxPlayers: 4, entryFee: "120" },
    { categoryId: csCat.id, name: "4v4", teamSize: 4, maxPlayers: 8, entryFee: "180" },
    // Lone Wolf modes
    { categoryId: lwCat.id, name: "1v1", teamSize: 1, maxPlayers: 2, entryFee: "50" },
  ]);
}

export async function getMatchCategories() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(matchCategories);
}

export async function getMatchModesByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(matchModes)
    .where(eq(matchModes.categoryId, categoryId));
}

export async function createMatch(match: InsertMatch): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(matches).values(match);
  return result[0].insertId;
}

export async function getUpcomingMatches(
  categoryId: number,
  modeId?: number,
  hoursAhead: number = 10
) {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const futureTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const conditions = [
    eq(matchCategories.id, categoryId),
    gte(matches.scheduledStartTime, now),
    lte(matches.scheduledStartTime, futureTime),
    eq(matches.status, "scheduled"),
  ];

  if (modeId) {
    conditions.push(eq(matchModes.id, modeId));
  }

  return await db
    .select({
      match: matches,
      mode: matchModes,
      category: matchCategories,
    })
    .from(matches)
    .innerJoin(matchModes, eq(matches.modeId, matchModes.id))
    .innerJoin(matchCategories, eq(matchModes.categoryId, matchCategories.id))
    .where(and(...conditions))
    .orderBy(matches.scheduledStartTime)
}

export async function getMatchById(matchId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateMatch(matchId: number, updates: Partial<typeof matches.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(matches).set(updates).where(eq(matches.id, matchId));
}

/**
 * MATCH PARTICIPANT OPERATIONS
 */
export async function joinMatch(
  matchId: number,
  userId: number,
  entryFeeDeducted: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(matchParticipants).values({
    matchId,
    userId,
    status: "joined",
    entryFeeDeducted,
  });

  // Increment match player count
  const match = await getMatchById(matchId);
  if (match) {
    await updateMatch(matchId, {
      currentPlayers: match.currentPlayers + 1,
    });
  }
}

export async function getMatchParticipants(matchId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId));
}

export async function getPlayerMatches(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(matchParticipants)
    .where(eq(matchParticipants.userId, userId));
}

export async function updateParticipantResult(
  participantId: number,
  killCount: number,
  rank: number,
  prizeAwarded: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(matchParticipants)
    .set({
      killCount,
      rank,
      prizeAwarded,
      status: "completed",
    })
    .where(eq(matchParticipants.id, participantId));
}

/**
 * TRANSACTION OPERATIONS
 */
export async function createTransaction(transaction: InsertTransaction): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(transactions).values(transaction);
  return result[0].insertId;
}

export async function getUserTransactions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt));
}

/**
 * DEPOSIT OPERATIONS
 */
export async function createDeposit(deposit: InsertDeposit): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(deposits).values(deposit);
  return result[0].insertId;
}

export async function getPendingDeposits() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(deposits)
    .where(eq(deposits.status, "pending"))
    .orderBy(deposits.createdAt);
}

export async function updateDepositStatus(
  depositId: number,
  status: "approved" | "rejected" | "completed",
  rejectionReason?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(deposits)
    .set({ status, rejectionReason })
    .where(eq(deposits.id, depositId));
}

/**
 * WITHDRAWAL OPERATIONS
 */
export async function createWithdrawal(withdrawal: InsertWithdrawal): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(withdrawals).values(withdrawal);
  return result[0].insertId;
}

export async function getPendingWithdrawals() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.status, "pending"))
    .orderBy(withdrawals.createdAt);
}

export async function updateWithdrawalStatus(
  withdrawalId: number,
  status: "approved" | "rejected" | "completed" | "failed",
  rejectionReason?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(withdrawals)
    .set({ status, rejectionReason })
    .where(eq(withdrawals.id, withdrawalId));
}

/**
 * REFERRAL OPERATIONS
 */
export async function createReferral(referral: InsertReferral): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(referrals).values(referral);
  return result[0].insertId;
}

export async function getReferralByCode(referralCode: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referralCode, referralCode))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * BANNED ACCOUNT OPERATIONS
 */
export async function isBanned(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(bannedAccounts)
    .where(eq(bannedAccounts.userId, userId))
    .limit(1);

  return result.length > 0;
}

export async function banUser(
  userId: number,
  reason: string,
  bannedBy?: number,
  details?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(bannedAccounts).values({
    userId,
    reason: reason as any,
    bannedBy,
    details,
  });

  // Mark user as banned
  await db
    .update(users)
    .set({ isBanned: true, banReason: reason })
    .where(eq(users.id, userId));
}
