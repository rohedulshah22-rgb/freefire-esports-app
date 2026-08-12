import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("app_role", ["user", "admin"]);
export const transactionKindEnum = pgEnum("transaction_kind", [
  "deposit",
  "withdrawal",
  "match_entry",
  "kill_reward",
  "prize_win",
  "refund",
  "referral_bonus",
  "admin_adjustment",
]);
export const balanceKindEnum = pgEnum("balance_kind", ["deposit", "winning", "bonus"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "cancelled"]);
export const matchStatusEnum = pgEnum("match_status", ["scheduled", "active", "completed", "cancelled", "expired"]);
export const participantStatusEnum = pgEnum("participant_status", ["joined", "confirmed", "cancelled", "completed"]);
export const depositStatusEnum = pgEnum("deposit_status", ["pending", "approved", "rejected"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "approved", "rejected", "completed"]);
export const payoutMethodEnum = pgEnum("payout_method", ["upi", "google_play"]);

export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  freeFireName: varchar("freeFireName", { length: 64 }),
  freeFireUid: varchar("freeFireUid", { length: 32 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: appRoleEnum("role").default("user").notNull(),
  deviceId: varchar("deviceId", { length: 128 }).unique(),
  isAndroidMobile: boolean("isAndroidMobile").default(true).notNull(),
  isBanned: boolean("isBanned").default(false).notNull(),
  banReason: text("banReason"),
  referralCode: varchar("referralCode", { length: 32 }).unique(),
  referredBy: bigint("referredBy", { mode: "number" }).references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  referralBonusAwarded: boolean("referralBonusAwarded").default(false).notNull(),
  adminUsername: varchar("adminUsername", { length: 64 }).unique(),
  adminPasswordHash: varchar("adminPasswordHash", { length: 255 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export const wallets = pgTable("wallets", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("userId", { mode: "number" }).notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  depositBalance: numeric("depositBalance", { precision: 12, scale: 2 }).default("0").notNull(),
  winningBalance: numeric("winningBalance", { precision: 12, scale: 2 }).default("0").notNull(),
  bonusBalance: numeric("bonusBalance", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const matchCategories = pgTable("matchCategories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const matchModes = pgTable("matchModes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  categoryId: bigint("categoryId", { mode: "number" }).notNull().references(() => matchCategories.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 64 }).notNull(),
  teamSize: integer("teamSize").notNull(),
  maxPlayers: integer("maxPlayers").notNull(),
  entryFee: numeric("entryFee", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const matches = pgTable("matches", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  categoryId: bigint("categoryId", { mode: "number" }).notNull().references(() => matchCategories.id, { onDelete: "restrict" }),
  modeId: bigint("modeId", { mode: "number" }).notNull().references(() => matchModes.id, { onDelete: "restrict" }),
  matchTitle: varchar("matchTitle", { length: 128 }).notNull(),
  mapName: varchar("mapName", { length: 128 }).notNull(),
  scheduledStartTime: timestamp("scheduledStartTime", { withTimezone: true }).notNull(),
  scheduledEndTime: timestamp("scheduledEndTime", { withTimezone: true }),
  roomId: varchar("roomId", { length: 64 }),
  roomPassword: varchar("roomPassword", { length: 64 }),
  credentialsVisibleAt: timestamp("credentialsVisibleAt", { withTimezone: true }),
  status: matchStatusEnum("status").default("scheduled").notNull(),
  entryFee: numeric("entryFee", { precision: 10, scale: 2 }).notNull(),
  totalSlots: integer("totalSlots").notNull(),
  totalPrizePool: numeric("totalPrizePool", { precision: 12, scale: 2 }).notNull(),
  perKillReward: numeric("perKillReward", { precision: 10, scale: 2 }).notNull(),
  adminProfitDeducted: numeric("adminProfitDeducted", { precision: 12, scale: 2 }).default("0").notNull(),
  currentPlayers: integer("currentPlayers").default(0).notNull(),
  minPlayersRequired: integer("minPlayersRequired").notNull(),
  cancellationReason: text("cancellationReason"),
  cancelledAt: timestamp("cancelledAt", { withTimezone: true }),
  refundProcessed: boolean("refundProcessed").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const deposits = pgTable("deposits", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("userId", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  utrNumber: varchar("utrNumber", { length: 12 }).notNull().unique(),
  status: depositStatusEnum("status").default("pending").notNull(),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const withdrawals = pgTable("withdrawals", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("userId", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  payoutMethod: payoutMethodEnum("payoutMethod").notNull(),
  payoutDetails: varchar("payoutDetails", { length: 255 }).notNull(),
  status: withdrawalStatusEnum("status").default("pending").notNull(),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  referrerId: bigint("referrerId", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  referredUserId: bigint("referredUserId", { mode: "number" }).notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  referralCode: varchar("referralCode", { length: 32 }).notNull(),
  bonusAwarded: boolean("bonusAwarded").default(false).notNull(),
  bonusAmount: numeric("bonusAmount", { precision: 10, scale: 2 }).default("5").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const matchParticipants = pgTable("matchParticipants", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  matchId: bigint("matchId", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
  userId: bigint("userId", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  freeFireIGN: varchar("freeFireIGN", { length: 32 }),
  freeFireUID: varchar("freeFireUID", { length: 32 }),
  status: participantStatusEnum("status").default("joined").notNull(),
  killCount: integer("killCount"),
  rank: integer("rank"),
  prizeAwarded: numeric("prizeAwarded", { precision: 12, scale: 2 }),
  entryFeeDeducted: numeric("entryFeeDeducted", { precision: 10, scale: 2 }).notNull(),
  refundAmount: numeric("refundAmount", { precision: 10, scale: 2 }),
  refundedAt: timestamp("refundedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("userId", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  type: transactionKindEnum("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  balanceType: balanceKindEnum("balanceType").notNull(),
  matchId: bigint("matchId", { mode: "number" }).references(() => matches.id, { onDelete: "set null" }),
  withdrawalId: bigint("withdrawalId", { mode: "number" }).references(() => withdrawals.id, { onDelete: "set null" }),
  referralId: bigint("referralId", { mode: "number" }).references(() => referrals.id, { onDelete: "set null" }),
  utrNumber: varchar("utrNumber", { length: 12 }),
  status: transactionStatusEnum("status").default("pending").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const adminAuditLog = pgTable("adminAuditLog", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  action: varchar("action", { length: 128 }).notNull(),
  details: jsonb("details"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type MatchCategory = typeof matchCategories.$inferSelect;
export type InsertMatchCategory = typeof matchCategories.$inferInsert;
export type MatchMode = typeof matchModes.$inferSelect;
export type InsertMatchMode = typeof matchModes.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;
export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type InsertMatchParticipant = typeof matchParticipants.$inferInsert;
export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = typeof deposits.$inferInsert;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = typeof withdrawals.$inferInsert;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;
