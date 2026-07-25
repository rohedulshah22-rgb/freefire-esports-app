import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  datetime,
  json,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with esports-specific fields.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  
  // Device & Security
  deviceId: varchar("deviceId", { length: 128 }).unique(),
  isAndroidMobile: boolean("isAndroidMobile").default(true).notNull(),
  isBanned: boolean("isBanned").default(false).notNull(),
  banReason: text("banReason"),
  
  // Referral System
  referralCode: varchar("referralCode", { length: 32 }).unique(),
  referredBy: int("referredBy"),
  referralBonusAwarded: boolean("referralBonusAwarded").default(false).notNull(),
  
  // Admin Credentials (for admin users only)
  adminUsername: varchar("adminUsername", { length: 64 }).unique(),
  adminPasswordHash: varchar("adminPasswordHash", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Wallet system with three balance types: Deposit, Winning, Bonus
 */
export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  
  // Balance in Coins/INR
  depositBalance: decimal("depositBalance", { precision: 12, scale: 2 }).default("0").notNull(),
  winningBalance: decimal("winningBalance", { precision: 12, scale: 2 }).default("0").notNull(),
  bonusBalance: decimal("bonusBalance", { precision: 12, scale: 2 }).default("0").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

/**
 * Transactions tracking all wallet movements
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  type: mysqlEnum("type", [
    "deposit",
    "withdrawal",
    "match_entry",
    "kill_reward",
    "prize_win",
    "refund",
    "referral_bonus",
  ]).notNull(),
  
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  balanceType: mysqlEnum("balanceType", ["deposit", "winning", "bonus"]).notNull(),
  
  // Related entities
  matchId: int("matchId"),
  withdrawalId: int("withdrawalId"),
  referralId: int("referralId"),
  
  // UTR for deposits
  utrNumber: varchar("utrNumber", { length: 12 }),
  
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).default("pending").notNull(),
  description: text("description"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Match categories: BR, CS, Lone Wolf
 */
export const matchCategories = mysqlTable("matchCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(), // "BR", "CS", "Lone Wolf"
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MatchCategory = typeof matchCategories.$inferSelect;
export type InsertMatchCategory = typeof matchCategories.$inferInsert;

/**
 * Match modes: 1v1, 2v2, 4v4
 */
export const matchModes = mysqlTable("matchModes", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  name: varchar("name", { length: 64 }).notNull(), // "1v1", "2v2", "4v4"
  teamSize: int("teamSize").notNull(), // 1, 2, 4
  maxPlayers: int("maxPlayers").notNull(), // 2, 4, 8
  entryFee: decimal("entryFee", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MatchMode = typeof matchModes.$inferSelect;
export type InsertMatchMode = typeof matchModes.$inferInsert;

/**
 * Individual matches - now with admin creation fields
 */
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  modeId: int("modeId").notNull(),
  
  // Match details for admin creation
  matchTitle: varchar("matchTitle", { length: 128 }).notNull(),
  mapName: varchar("mapName", { length: 128 }).notNull(),
  
  // Schedule
  scheduledStartTime: datetime("scheduledStartTime").notNull(),
  scheduledEndTime: datetime("scheduledEndTime"),
  
  // Room credentials (hidden until 15 mins before start)
  roomId: varchar("roomId", { length: 64 }),
  roomPassword: varchar("roomPassword", { length: 64 }),
  credentialsVisibleAt: datetime("credentialsVisibleAt"),
  
  // Match state
  status: mysqlEnum("status", [
    "scheduled",
    "active",
    "completed",
    "cancelled",
  ]).default("scheduled").notNull(),
  
  // Entry fee and prize pool
  entryFee: decimal("entryFee", { precision: 10, scale: 2 }).notNull(),
  totalSlots: int("totalSlots").notNull(),
  totalPrizePool: decimal("totalPrizePool", { precision: 12, scale: 2 }).notNull(),
  perKillReward: decimal("perKillReward", { precision: 10, scale: 2 }).notNull(),
  adminProfitDeducted: decimal("adminProfitDeducted", { precision: 12, scale: 2 }).default("0"),
  
  // Player count
  currentPlayers: int("currentPlayers").default(0).notNull(),
  minPlayersRequired: int("minPlayersRequired").notNull(),
  
  // Cancellation tracking
  cancellationReason: text("cancellationReason"),
  cancelledAt: datetime("cancelledAt"),
  refundProcessed: boolean("refundProcessed").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Player participation in matches
 */
export const matchParticipants = mysqlTable("matchParticipants", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId").notNull(),
  userId: int("userId").notNull(),
  
  // Participation state
  status: mysqlEnum("status", [
    "joined",
    "confirmed",
    "cancelled",
    "completed",
  ]).default("joined").notNull(),
  
  // Results (filled by admin)
  killCount: int("killCount"),
  rank: int("rank"),
  prizeAwarded: decimal("prizeAwarded", { precision: 12, scale: 2 }),
  
  // Entry fee deducted from wallet
  entryFeeDeducted: decimal("entryFeeDeducted", { precision: 10, scale: 2 }).notNull(),
  
  // Refund tracking
  refundAmount: decimal("refundAmount", { precision: 10, scale: 2 }),
  refundedAt: datetime("refundedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type InsertMatchParticipant = typeof matchParticipants.$inferInsert;

/**
 * Deposits - money added to wallet
 */
export const deposits = mysqlTable("deposits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  utrNumber: varchar("utrNumber", { length: 12 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = typeof deposits.$inferInsert;

/**
 * Withdrawals - money withdrawn from wallet
 */
export const withdrawals = mysqlTable("withdrawals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  payoutMethod: mysqlEnum("payoutMethod", ["upi", "google_play"]).notNull(),
  payoutDetails: varchar("payoutDetails", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "completed"]).default("pending").notNull(),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = typeof withdrawals.$inferInsert;

/**
 * Referrals - track referral relationships and bonuses
 */
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerId: int("referrerId").notNull(),
  referredUserId: int("referredUserId").notNull(),
  referralCode: varchar("referralCode", { length: 32 }).notNull(),
  bonusAwarded: boolean("bonusAwarded").default(false).notNull(),
  bonusAmount: decimal("bonusAmount", { precision: 10, scale: 2 }).default("5").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

/**
 * Admin audit log for tracking all admin actions
 */
export const adminAuditLog = mysqlTable("adminAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 128 }).notNull(),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;
