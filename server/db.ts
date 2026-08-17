import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createHash, randomUUID } from "node:crypto";
import * as schema from "../drizzle/schema";
import {
  type InsertDeposit,
  type InsertMatch,
  type InsertPaymentAttempt,
  type InsertReferral,
  type InsertTransaction,
  type InsertUser,
  type InsertWithdrawal,
  adminAuditLog,
  announcements,
  dailyCheckIns,
  deposits,
  leaderboardSettings,
  matchCategories,
  matchModes,
  matchParticipants,
  matchResultProofs,
  matchTeamMembers,
  matches,
  paymentAttempts,
  referrals,
  referralSettings,
  transactions,
  users,
  wallets,
  withdrawals,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { ADMIN_OWNER_EMAIL } from "./adminAccess";
import { calculateTournamentAwards } from "./tournamentPayouts";
import { allocateEntryFee } from "./tournamentWalletRules";
import { storagePut } from "./storage";

let pool: Pool | null = null;
let database: NodePgDatabase<typeof schema> | null = null;
export type WorkflowDatabase = NodePgDatabase<typeof schema>;

function getNumericPlayerUid(userId: number) {
  return String(8_000_000_000 + userId);
}

export const MINIMUM_WITHDRAWAL_COINS = 50;

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

  const designatedAdminEmail = ADMIN_OWNER_EMAIL;
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
      const [existingByOpenId] = await db.select().from(users)
        .where(eq(users.openId, user.openId))
        .limit(1);
      if (existingByOpenId && existingByOpenId.id !== existingByEmail.id) {
        throw new Error("OAuth identity is already linked to a different account; reconcile the duplicate account before signing in");
      }
      await db.update(users).set({
        openId: user.openId,
        name: user.name ?? existingByEmail.name,
        email: user.email,
        loginMethod: user.loginMethod ?? existingByEmail.loginMethod,
        role: shouldBeAdmin ? "admin" : existingByEmail.role,
        playerUid: existingByEmail.playerUid ?? getNumericPlayerUid(existingByEmail.id),
        lastSignedIn,
        updatedAt: new Date(),
      }).where(eq(users.id, existingByEmail.id));
      return;
    }
  }

  const [persistedUser] = await db.insert(users).values({
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    role,
    lastSignedIn,
  }).onConflictDoUpdate({
    target: users.openId,
    set: {
      name: user.name ?? sql`${users.name}`,
      email: user.email ?? sql`${users.email}`,
      loginMethod: user.loginMethod ?? sql`${users.loginMethod}`,
      role: shouldBeAdmin ? "admin" : sql`${users.role}`,
      lastSignedIn,
      updatedAt: new Date(),
    },
  }).returning({ id: users.id, playerUid: users.playerUid });

  if (persistedUser && !persistedUser.playerUid) {
    await db.update(users).set({ playerUid: getNumericPlayerUid(persistedUser.id), updatedAt: new Date() })
      .where(eq(users.id, persistedUser.id));
  }
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

export async function registerPlayerDevice(
  userId: number,
  deviceToken: string,
  databaseOverride?: WorkflowDatabase,
) {
  const deviceId = hashReferralSignal(deviceToken);
  if (!deviceId) throw new Error("A valid device identifier is required");
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    const [player] = await tx.select({ id: users.id, deviceId: users.deviceId }).from(users)
      .where(eq(users.id, userId)).limit(1).for("update");
    if (!player) throw new Error("Player account not found");
    if (player.deviceId === deviceId) return { sharedDevice: false, registered: false } as const;

    const [existingDeviceOwner] = await tx.select({ id: users.id }).from(users)
      .where(eq(users.deviceId, deviceId)).limit(1).for("update");
    if (existingDeviceOwner && existingDeviceOwner.id !== userId) {
      await captureReferralFraudSignals(userId, { deviceToken }, tx);
      return { sharedDevice: true, registered: false } as const;
    }

    await tx.update(users).set({ deviceId, updatedAt: new Date() }).where(eq(users.id, userId));
    await captureReferralFraudSignals(userId, { deviceToken }, tx);
    return { sharedDevice: false, registered: true } as const;
  });
}

export type ReferralFraudSignals = {
  deviceToken?: string | null;
  requestOrigin?: string | null;
};

function hashReferralSignal(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? createHash("sha256").update(normalized).digest("hex") : null;
}

function normalizeReferralCode(code: string) {
  return code.trim().toUpperCase();
}

async function getOrCreateReferralCode(userId: number, db: WorkflowDatabase) {
  const [user] = await db.select({ referralCode: users.referralCode }).from(users)
    .where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Player account not found");
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const referralCode = `FF${userId}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const updated = await db.update(users).set({ referralCode, updatedAt: new Date() })
      .where(and(eq(users.id, userId), sql`${users.referralCode} IS NULL`))
      .returning({ referralCode: users.referralCode });
    if (updated[0]?.referralCode) return updated[0].referralCode;
    const [existing] = await db.select({ referralCode: users.referralCode }).from(users)
      .where(eq(users.id, userId)).limit(1);
    if (existing?.referralCode) return existing.referralCode;
  }
  throw new Error("Unable to generate a referral code");
}

async function captureReferralFraudSignals(userId: number, signals: ReferralFraudSignals, db: WorkflowDatabase) {
  const deviceHash = hashReferralSignal(signals.deviceToken);
  const ipHash = hashReferralSignal(signals.requestOrigin);
  if (!deviceHash && !ipHash) return;
  await db.update(users).set({
    referralDeviceHash: deviceHash ? sql`COALESCE(${users.referralDeviceHash}, ${deviceHash})` : undefined,
    referralIpHash: ipHash ? sql`COALESCE(${users.referralIpHash}, ${ipHash})` : undefined,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
}

export async function getReferralSettings(databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  await db.insert(referralSettings).values({ id: 1 }).onConflictDoNothing();
  const [settings] = await db.select().from(referralSettings).where(eq(referralSettings.id, 1)).limit(1);
  if (!settings) throw new Error("Referral settings could not be initialized");
  return settings;
}

export async function getReferralDashboard(
  userId: number,
  signals: ReferralFraudSignals,
  databaseOverride?: WorkflowDatabase,
) {
  const db = databaseOverride ?? await requireDb();
  await captureReferralFraudSignals(userId, signals, db);
  const referralCode = await getOrCreateReferralCode(userId, db);
  const settings = await getReferralSettings(db);
  const history = await db.select({
    id: referrals.id,
    referralCode: referrals.referralCode,
    status: referrals.status,
    fraudReason: referrals.fraudReason,
    referrerBonusAmount: referrals.referrerBonusAmount,
    refereeBonusAmount: referrals.refereeBonusAmount,
    qualifiedAt: referrals.qualifiedAt,
    rewardedAt: referrals.rewardedAt,
    createdAt: referrals.createdAt,
    invitedName: sql<string>`COALESCE(${users.freeFireName}, ${users.name}, 'Free Fire Player')`,
  }).from(referrals).innerJoin(users, eq(referrals.referredUserId, users.id))
    .where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));
  const [summary] = await db.select({
    invitedCount: sql<number>`COUNT(*)::int`,
    rewardedCount: sql<number>`COUNT(*) FILTER (WHERE ${referrals.status} = 'rewarded')::int`,
    earnedBonus: sql<string>`COALESCE(SUM(${referrals.referrerBonusAmount}) FILTER (WHERE ${referrals.status} = 'rewarded'), 0)::text`,
  }).from(referrals).where(eq(referrals.referrerId, userId));
  return { referralCode, settings, history, summary: { invitedCount: Number(summary?.invitedCount ?? 0), rewardedCount: Number(summary?.rewardedCount ?? 0), earnedBonus: Number(summary?.earnedBonus ?? 0) } };
}

export async function enrollReferralCode(
  referredUserId: number,
  referralCodeInput: string,
  signals: ReferralFraudSignals,
  databaseOverride?: WorkflowDatabase,
) {
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    const referralCode = normalizeReferralCode(referralCodeInput);
    const [referred] = await tx.select().from(users).where(eq(users.id, referredUserId)).limit(1).for("update");
    if (!referred) throw new Error("Player account not found");
    const [existingReferral] = await tx.select().from(referrals).where(eq(referrals.referredUserId, referredUserId)).limit(1).for("update");
    if (existingReferral || referred.referredBy) throw new Error("A referral code has already been applied to this account");
    const [referrer] = await tx.select().from(users).where(eq(users.referralCode, referralCode)).limit(1).for("update");
    if (!referrer) throw new Error("Referral code not found");
    if (referrer.id === referredUserId) throw new Error("You cannot apply your own referral code");
    const settings = await getReferralSettings(tx);
    if (!settings.isEnabled) throw new Error("Refer & Earn is currently unavailable");

    await captureReferralFraudSignals(referredUserId, signals, tx);
    const [refreshedReferred] = await tx.select().from(users).where(eq(users.id, referredUserId)).limit(1).for("update");
    const sameDevice = !!referrer.referralDeviceHash && referrer.referralDeviceHash === refreshedReferred?.referralDeviceHash;
    const sameOrigin = !!referrer.referralIpHash && referrer.referralIpHash === refreshedReferred?.referralIpHash;
    const fraudReason = sameDevice ? "same_device" : sameOrigin ? "same_request_origin" : null;
    const status = fraudReason ? "blocked" : "pending";
    const referralRows = await tx.insert(referrals).values({
      referrerId: referrer.id, referredUserId, referralCode, status, fraudReason,
      referrerBonusAmount: settings.referrerBonusAmount, refereeBonusAmount: settings.refereeBonusAmount,
      bonusAmount: settings.referrerBonusAmount,
    }).returning({ id: referrals.id, status: referrals.status });
    await tx.update(users).set({ referredBy: referrer.id, updatedAt: new Date() }).where(eq(users.id, referredUserId));
    return { referralId: referralRows[0]!.id, status: referralRows[0]!.status, blocked: !!fraudReason };
  });
}

export async function settleReferralRewardAfterFirstMatchJoin(
  referredUserId: number,
  databaseOverride?: WorkflowDatabase,
) {
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    const referralRows = await tx.select().from(referrals).where(eq(referrals.referredUserId, referredUserId)).limit(1).for("update");
    const referral = referralRows[0];
    if (!referral || referral.status !== "pending") return { rewarded: false, reason: referral?.status ?? "no_referral" } as const;
    const [matchCount] = await tx.select({ count: sql<number>`COUNT(*)::int` }).from(matchParticipants)
      .where(eq(matchParticipants.userId, referredUserId));
    if (Number(matchCount?.count ?? 0) !== 1) return { rewarded: false, reason: "not_first_join" } as const;
    const settings = await getReferralSettings(tx);
    if (!settings.isEnabled) return { rewarded: false, reason: "disabled" } as const;

    for (const userId of [referral.referrerId, referral.referredUserId]) {
      await tx.insert(wallets).values({ userId, depositBalance: "0", winningBalance: "0", bonusBalance: "0" })
        .onConflictDoNothing({ target: wallets.userId });
      await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1).for("update");
    }
    await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} + ${Number(referral.referrerBonusAmount)}`, updatedAt: new Date() })
      .where(eq(wallets.userId, referral.referrerId));
    await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} + ${Number(referral.refereeBonusAmount)}`, updatedAt: new Date() })
      .where(eq(wallets.userId, referral.referredUserId));
    await tx.insert(transactions).values([
      { userId: referral.referrerId, type: "referral_bonus", amount: Number(referral.referrerBonusAmount).toFixed(2), balanceType: "bonus", referralId: referral.id, status: "completed", description: "Refer & Earn reward after your invited player joined their first match" },
      { userId: referral.referredUserId, type: "referral_bonus", amount: Number(referral.refereeBonusAmount).toFixed(2), balanceType: "bonus", referralId: referral.id, status: "completed", description: "Refer & Earn welcome reward after your first match join" },
    ]);
    await tx.update(referrals).set({ status: "rewarded", bonusAwarded: true, qualifiedAt: new Date(), rewardedAt: new Date() })
      .where(eq(referrals.id, referral.id));
    await tx.update(users).set({ referralBonusAwarded: true, updatedAt: new Date() }).where(eq(users.id, referredUserId));
    return { rewarded: true, referrerId: referral.referrerId, referredUserId } as const;
  });
}

export async function updateReferralSettings(
  updatedBy: number,
  input: { isEnabled: boolean; referrerBonusAmount: string; refereeBonusAmount: string },
) {
  const db = await requireDb();
  await getReferralSettings(db);
  const [settings] = await db.update(referralSettings).set({ ...input, updatedBy, updatedAt: new Date() })
    .where(eq(referralSettings.id, 1)).returning();
  await db.insert(adminAuditLog).values({ action: "referral_settings_updated", details: { updatedBy, ...input } });
  return settings;
}

export async function getReferralAdminStats() {
  const db = await requireDb();
  const [stats] = await db.select({
    totalReferrals: sql<number>`COUNT(*)::int`,
    pendingReferrals: sql<number>`COUNT(*) FILTER (WHERE ${referrals.status} = 'pending')::int`,
    rewardedReferrals: sql<number>`COUNT(*) FILTER (WHERE ${referrals.status} = 'rewarded')::int`,
    blockedReferrals: sql<number>`COUNT(*) FILTER (WHERE ${referrals.status} = 'blocked')::int`,
    totalPaid: sql<string>`COALESCE(SUM(${referrals.referrerBonusAmount} + ${referrals.refereeBonusAmount}) FILTER (WHERE ${referrals.status} = 'rewarded'), 0)::text`,
  }).from(referrals);
  return {
    totalReferrals: Number(stats?.totalReferrals ?? 0), pendingReferrals: Number(stats?.pendingReferrals ?? 0),
    rewardedReferrals: Number(stats?.rewardedReferrals ?? 0), blockedReferrals: Number(stats?.blockedReferrals ?? 0), totalPaid: Number(stats?.totalPaid ?? 0),
  };
}

export type LeaderboardMetric = "kills" | "earnings" | "matches";
export type LeaderboardPeriod = "daily" | "weekly" | "all";

export function getLeaderboardPeriodStart(period: LeaderboardPeriod, weeklyCycleStartedAt: Date) {
  if (period === "all") return null;
  if (period === "weekly") return weeklyCycleStartedAt;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getLeaderboardRankBadge(rank: number, proLegendLabel: string) {
  if (rank <= 3) return "Podium Elite";
  if (rank <= 10) return proLegendLabel;
  if (rank <= 50) return "Rising Pro";
  return "Contender";
}

export async function getLeaderboardSettings(databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  await db.insert(leaderboardSettings).values({ id: 1 }).onConflictDoNothing();
  const [settings] = await db.select().from(leaderboardSettings).where(eq(leaderboardSettings.id, 1)).limit(1);
  if (!settings) throw new Error("Leaderboard settings could not be initialized");
  return settings;
}

export async function getLeaderboard(
  userId: number,
  input: { metric: LeaderboardMetric; period: LeaderboardPeriod },
  databaseOverride?: WorkflowDatabase,
) {
  const db = databaseOverride ?? await requireDb();
  const settings = await getLeaderboardSettings(db);
  const periodStart = getLeaderboardPeriodStart(input.period, settings.weeklyCycleStartedAt);
  const participantCondition = periodStart
    ? and(eq(matchParticipants.userId, users.id), gte(matchParticipants.updatedAt, periodStart))
    : eq(matchParticipants.userId, users.id);

  const rows = await db.select({
    userId: users.id,
    username: sql<string>`COALESCE(${users.freeFireName}, ${users.name}, 'Free Fire Player')`,
    freeFireUid: users.freeFireUid,
    avatarUrl: users.avatarUrl,
    totalKills: sql<number>`COALESCE(SUM(COALESCE(${matchParticipants.killCount}, 0)), 0)::int`,
    totalEarnings: sql<string>`COALESCE(SUM(COALESCE(${matchParticipants.prizeAwarded}, 0)), 0)::text`,
    matchesPlayed: sql<number>`COUNT(${matchParticipants.id})::int`,
  })
    .from(users)
    .leftJoin(matchParticipants, participantCondition)
    .where(eq(users.isBanned, false))
    .groupBy(users.id, users.freeFireName, users.name, users.freeFireUid, users.avatarUrl);

  const entries = rows.map((row) => ({
    ...row,
    totalKills: Number(row.totalKills),
    totalEarnings: Number(row.totalEarnings),
    matchesPlayed: Number(row.matchesPlayed),
  })).sort((left, right) => {
    const metricValue = (entry: typeof left) => input.metric === "kills"
      ? entry.totalKills
      : input.metric === "earnings"
        ? entry.totalEarnings
        : entry.matchesPlayed;
    return metricValue(right) - metricValue(left)
      || right.totalKills - left.totalKills
      || right.totalEarnings - left.totalEarnings
      || right.matchesPlayed - left.matchesPlayed
      || left.username.localeCompare(right.username);
  }).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    rankBadge: getLeaderboardRankBadge(index + 1, settings.proLegendLabel),
  }));

  return {
    settings,
    periodStart,
    entries,
    myEntry: entries.find((entry) => entry.userId === userId) ?? null,
  };
}

export async function updateLeaderboardRewards(
  updatedBy: number,
  input: { top1Reward: string; top2Reward: string; top3Reward: string; proLegendLabel: string },
) {
  const db = await requireDb();
  await getLeaderboardSettings(db);
  const [settings] = await db.update(leaderboardSettings).set({
    top1Reward: input.top1Reward,
    top2Reward: input.top2Reward,
    top3Reward: input.top3Reward,
    proLegendLabel: input.proLegendLabel,
    updatedBy,
    updatedAt: new Date(),
  }).where(eq(leaderboardSettings.id, 1)).returning();
  await db.insert(adminAuditLog).values({ action: "leaderboard_rewards_updated", details: { updatedBy } });
  return settings;
}

export async function resetLeaderboardWeeklyCycle(updatedBy: number) {
  const db = await requireDb();
  await getLeaderboardSettings(db);
  const [settings] = await db.update(leaderboardSettings).set({
    weeklyCycleStartedAt: new Date(),
    updatedBy,
    updatedAt: new Date(),
  }).where(eq(leaderboardSettings.id, 1)).returning();
  await db.insert(adminAuditLog).values({ action: "leaderboard_weekly_cycle_reset", details: { updatedBy } });
  return settings;
}

export async function getPlayerProfile(userId: number, databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  let [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Player account not found");

  if (!user.playerUid) {
    const playerUid = getNumericPlayerUid(user.id);
    await db.update(users).set({ playerUid, updatedAt: new Date() }).where(eq(users.id, user.id));
    user = { ...user, playerUid };
  }

  const [stats] = await db.select({
    totalMatches: sql<number>`COUNT(*)::int`,
    totalKills: sql<number>`COALESCE(SUM(${matchParticipants.killCount}), 0)::int`,
    totalEarnings: sql<string>`COALESCE(SUM(${matchParticipants.prizeAwarded}), 0)::text`,
    matchesWon: sql<number>`COUNT(*) FILTER (WHERE ${matchParticipants.status} = 'completed' AND ${matchParticipants.rank} = 1)::int`,
    completedMatches: sql<number>`COUNT(*) FILTER (WHERE ${matchParticipants.status} = 'completed')::int`,
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
    career: { matchesWon: stats?.matchesWon ?? 0, winRate: (stats?.completedMatches ?? 0) > 0 ? Number((((stats?.matchesWon ?? 0) / (stats?.completedMatches ?? 1)) * 100).toFixed(1)) : 0 },
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

const AVATAR_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function decodeAvatarImage(base64: string, mimeType: keyof typeof AVATAR_MIME_TYPES) {
  const normalized = base64.replace(/^data:image\/(?:jpeg|png|webp);base64,/, "");
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) throw new Error("Upload a valid image file");
  const image = Buffer.from(normalized, "base64");
  if (image.length === 0 || image.length > 2 * 1024 * 1024) throw new Error("Avatar images must be 2 MB or smaller");
  const validSignature = (mimeType === "image/jpeg" && image.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    || (mimeType === "image/png" && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    || (mimeType === "image/webp" && image.subarray(0, 4).toString("ascii") === "RIFF" && image.subarray(8, 12).toString("ascii") === "WEBP");
  if (!validSignature) throw new Error("The selected file does not match its declared image type");
  return image;
}

export async function updatePlayerAvatar(
  userId: number,
  input: { base64: string; mimeType: keyof typeof AVATAR_MIME_TYPES },
  databaseOverride?: WorkflowDatabase,
) {
  const image = decodeAvatarImage(input.base64, input.mimeType);
  const extension = AVATAR_MIME_TYPES[input.mimeType];
  const { url } = await storagePut(`player-avatars/${userId}/${randomUUID()}.${extension}`, image, input.mimeType);
  const db = databaseOverride ?? await requireDb();
  await db.update(users).set({ avatarUrl: url, updatedAt: new Date() }).where(eq(users.id, userId));
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
      customModeTag: matches.customModeTag,
      rulesSummary: matches.rulesSummary,
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
      customModeTag: matches.customModeTag,
      rulesSummary: matches.rulesSummary,
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

/** Owner-only data contract for scheduled and live tournaments. */
export async function getAdminActiveMatches(databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  return db.select({
    id: matches.id,
    matchTitle: matches.matchTitle,
    mapName: matches.mapName,
    customModeTag: matches.customModeTag,
    scheduledStartTime: matches.scheduledStartTime,
    status: matches.status,
    entryFee: matches.entryFee,
    totalSlots: matches.totalSlots,
    currentPlayers: matches.currentPlayers,
    roomId: matches.roomId,
    roomPassword: matches.roomPassword,
    credentialsVisibleAt: matches.credentialsVisibleAt,
    categoryName: matchCategories.name,
    modeName: matchModes.name,
  }).from(matches)
    .innerJoin(matchCategories, eq(matches.categoryId, matchCategories.id))
    .innerJoin(matchModes, eq(matches.modeId, matchModes.id))
    .where(inArray(matches.status, ["scheduled", "active"]))
    .orderBy(matches.scheduledStartTime);
}

export async function publishMatchRoomCredentials(
  matchId: number,
  input: { roomId: string; roomPassword: string },
  adminUserId: number,
  databaseOverride?: WorkflowDatabase,
) {
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    const rows = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
    const match = rows[0];
    if (!match) throw new Error("Match not found");
    if (match.status !== "scheduled" && match.status !== "active") throw new Error("Room details can only be published for active matches");
    await tx.update(matches).set({ roomId: input.roomId, roomPassword: input.roomPassword, updatedAt: new Date() })
      .where(eq(matches.id, matchId));
    await tx.insert(adminAuditLog).values({
      action: "match.room_credentials_published",
      details: { matchId, adminUserId, credentialsVisibleAt: match.credentialsVisibleAt?.toISOString() ?? null },
    });
    return { matchId, credentialsVisibleAt: match.credentialsVisibleAt };
  });
}

/**
 * Cancels a scheduled/live match and refunds each participant exactly once.
 * The match row is locked first and every participant receives a durable refund
 * marker in the same transaction, so duplicate Admin taps are harmless.
 */
export async function cancelMatchAndRefund(
  matchId: number,
  adminUserId: number,
  cancellationReason: string,
  databaseOverride?: WorkflowDatabase,
) {
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    const matchRows = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
    const match = matchRows[0];
    if (!match) throw new Error("Match not found");
    if (match.status === "cancelled" && match.refundProcessed) {
      return { matchId, alreadyCancelled: true, refundedPlayers: 0, totalRefunded: 0 };
    }
    if (match.status !== "scheduled" && match.status !== "active") throw new Error("Only scheduled or active matches can be cancelled");

    const participants = await tx.select().from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId))
      .for("update");
    const refundableParticipants = participants.filter((participant) => !participant.refundedAt);
    let totalRefunded = 0;

    for (const participant of refundableParticipants) {
      const amount = Number(participant.entryFeeDeducted);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid participant entry fee");
      await tx.insert(wallets).values({ userId: participant.userId, depositBalance: "0", winningBalance: "0", bonusBalance: "0" })
        .onConflictDoNothing({ target: wallets.userId });
      await tx.update(wallets).set({ depositBalance: sql`${wallets.depositBalance} + ${amount}` })
        .where(eq(wallets.userId, participant.userId));
      await tx.insert(transactions).values({
        userId: participant.userId,
        type: "refund",
        amount: amount.toFixed(2),
        balanceType: "deposit",
        matchId,
        status: "completed",
        description: `Match ${matchId} cancelled by Admin: ${cancellationReason}`,
      });
      await tx.update(matchParticipants).set({
        status: "cancelled",
        refundAmount: amount.toFixed(2),
        refundedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(matchParticipants.id, participant.id));
      totalRefunded += amount;
    }

    const now = new Date();
    await tx.update(matches).set({
      status: "cancelled",
      cancellationReason,
      cancelledAt: now,
      refundProcessed: true,
      updatedAt: now,
    }).where(eq(matches.id, matchId));
    await tx.insert(adminAuditLog).values({
      action: "match.cancelled_with_refunds",
      details: { matchId, adminUserId, cancellationReason, refundedPlayers: refundableParticipants.length, totalRefunded },
    });
    return { matchId, alreadyCancelled: false, refundedPlayers: refundableParticipants.length, totalRefunded };
  });
}

export async function joinMatch(
  matchId: number,
  userId: number,
  freeFireIGN: string,
  freeFireUID: string,
  teamMembers: Array<{ name: string; uid: string }> | WorkflowDatabase = [],
  databaseOverride?: WorkflowDatabase,
) {
  if (!Array.isArray(teamMembers)) { databaseOverride = teamMembers; teamMembers = []; }
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    const matchRows = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
    const match = matchRows[0];
    if (!match) throw new Error("Match not found");
    if (match.status !== "scheduled" || match.scheduledStartTime <= new Date()) {
      throw new Error("Match is not accepting players");
    }
    if (match.currentPlayers >= match.totalSlots) throw new Error("Match is full");
    const [mode] = await tx.select().from(matchModes).where(eq(matchModes.id, match.modeId)).limit(1);
    if (!mode) throw new Error("Match mode not found");
    const expectedMembers = Math.max(0, mode.teamSize - 1);
    const normalizedTeam = teamMembers.map((member) => ({ name: member.name.trim(), uid: member.uid.trim() }));
    if (normalizedTeam.length !== expectedMembers || normalizedTeam.some((member) => member.name.length < 2 || member.name.length > 32 || !/^\d{6,32}$/.test(member.uid)) || new Set(normalizedTeam.map((member) => member.uid)).size !== normalizedTeam.length || normalizedTeam.some((member) => member.uid === freeFireUID.trim())) throw new Error(expectedMembers ? `Enter ${expectedMembers} valid teammate Name and UID record${expectedMembers > 1 ? "s" : ""}` : "Solo modes do not accept teammate records");

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
    if (normalizedTeam.length) await tx.insert(matchTeamMembers).values(normalizedTeam.map((member) => ({ participantId, memberName: member.name, memberUid: member.uid })));

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

    const referralReward = await settleReferralRewardAfterFirstMatchJoin(userId, tx);

    return { participantId, matchId, deductedFromDeposit, deductedFromBonus, referralReward };
  });
}

export async function getMatchParticipants(matchId: number, databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  return db.select({
    id: matchParticipants.id,
    matchId: matchParticipants.matchId,
    userId: matchParticipants.userId,
    freeFireIGN: matchParticipants.freeFireIGN,
    freeFireUID: matchParticipants.freeFireUID,
    status: matchParticipants.status,
    killCount: matchParticipants.killCount,
    rank: matchParticipants.rank,
    prizeAwarded: matchParticipants.prizeAwarded,
    joinedAt: matchParticipants.createdAt,
    username: sql<string>`COALESCE(${users.freeFireName}, ${users.name}, ${matchParticipants.freeFireIGN}, 'Free Fire Player')`,
    avatarUrl: users.avatarUrl,
  }).from(matchParticipants)
    .innerJoin(users, eq(matchParticipants.userId, users.id))
    .where(eq(matchParticipants.matchId, matchId))
    .orderBy(matchParticipants.createdAt);
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

export async function createDeposit(deposit: InsertDeposit, databaseOverride?: WorkflowDatabase): Promise<number> {
  const db = databaseOverride ?? await getDb();
  if (!db) throw new Error("Neon database is not configured");
  const result = await db.insert(deposits).values(deposit).returning({ id: deposits.id });
  return result[0]!.id;
}

export async function getAdminFinancialSummary(databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  const [depositSummary, withdrawalSummary] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(${deposits.amount}) FILTER (WHERE ${deposits.status} = 'approved'), 0)::text` }).from(deposits),
    db.select({ total: sql<string>`COALESCE(SUM(${withdrawals.amount}) FILTER (WHERE ${withdrawals.status} = 'completed'), 0)::text` }).from(withdrawals),
  ]);
  return {
    totalApprovedDeposits: Number(depositSummary[0]?.total ?? 0),
    totalCompletedWithdrawals: Number(withdrawalSummary[0]?.total ?? 0),
  };
}

export async function createPaymentAttempt(
  paymentAttempt: InsertPaymentAttempt,
  databaseOverride?: WorkflowDatabase,
) {
  if (!Number.isFinite(Number(paymentAttempt.amount)) || Number(paymentAttempt.amount) <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }
  const db = databaseOverride ?? await requireDb();
  const result = await db.insert(paymentAttempts).values(paymentAttempt).returning({ id: paymentAttempts.id });
  return result[0]!.id;
}

export async function attachPaymentAttemptOrder(
  paymentAttemptId: number,
  providerOrderId: string,
  databaseOverride?: WorkflowDatabase,
) {
  const db = databaseOverride ?? await requireDb();
  const updated = await db.update(paymentAttempts).set({ providerOrderId, updatedAt: new Date() })
    .where(eq(paymentAttempts.id, paymentAttemptId))
    .returning({ id: paymentAttempts.id });
  if (updated.length === 0) throw new Error("Payment attempt not found");
}

export async function getPaymentAttemptForUser(
  paymentAttemptId: number,
  userId: number,
  databaseOverride?: WorkflowDatabase,
) {
  const db = databaseOverride ?? await requireDb();
  const rows = await db.select().from(paymentAttempts)
    .where(and(eq(paymentAttempts.id, paymentAttemptId), eq(paymentAttempts.userId, userId)))
    .limit(1);
  return rows[0];
}

/**
 * Applies a verified provider payment exactly once. The payment-attempt row is
 * locked first, making provider webhook redelivery harmless and auditable.
 */
export async function settleVerifiedPaymentAttempt(
  input: { providerOrderId: string; providerPaymentId: string; providerEventId?: string },
  databaseOverride?: WorkflowDatabase,
) {
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    const attemptRows = await tx.select().from(paymentAttempts)
      .where(eq(paymentAttempts.providerOrderId, input.providerOrderId))
      .limit(1)
      .for("update");
    const attempt = attemptRows[0];
    if (!attempt) throw new Error("Payment attempt not found");
    if (attempt.provider !== "razorpay") throw new Error("Unsupported payment provider");
    if (attempt.status === "captured") {
      if (attempt.providerPaymentId && attempt.providerPaymentId !== input.providerPaymentId) {
        throw new Error("Payment attempt already settled with a different payment");
      }
      return { paymentAttemptId: attempt.id, credited: false, status: attempt.status } as const;
    }
    if (attempt.status === "failed" || attempt.status === "cancelled") {
      throw new Error("Payment attempt cannot be settled after failure or cancellation");
    }

    await tx.insert(wallets).values({ userId: attempt.userId, depositBalance: "0", winningBalance: "0", bonusBalance: "0" })
      .onConflictDoNothing({ target: wallets.userId });
    await tx.select().from(wallets).where(eq(wallets.userId, attempt.userId)).limit(1).for("update");

    await tx.update(paymentAttempts).set({
      providerPaymentId: input.providerPaymentId,
      providerEventId: input.providerEventId ?? null,
      status: "captured",
      failureReason: null,
      capturedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(paymentAttempts.id, attempt.id));
    await tx.update(wallets).set({
      depositBalance: sql`${wallets.depositBalance} + ${Number(attempt.amount)}`,
      updatedAt: new Date(),
    }).where(eq(wallets.userId, attempt.userId));
    await tx.insert(transactions).values({
      userId: attempt.userId,
      type: "deposit",
      amount: Number(attempt.amount).toFixed(2),
      balanceType: "deposit",
      paymentAttemptId: attempt.id,
      status: "completed",
      description: `Verified Razorpay payment ${input.providerPaymentId}`,
    });
    return { paymentAttemptId: attempt.id, credited: true, status: "captured" } as const;
  });
}

export async function markPaymentAttemptFailed(
  providerOrderId: string,
  failureReason: string,
  databaseOverride?: WorkflowDatabase,
) {
  return withinWorkflowTransaction(databaseOverride, async (tx) => {
    const attemptRows = await tx.select().from(paymentAttempts)
      .where(eq(paymentAttempts.providerOrderId, providerOrderId))
      .limit(1)
      .for("update");
    const attempt = attemptRows[0];
    if (!attempt) throw new Error("Payment attempt not found");
    if (attempt.status === "captured") return { paymentAttemptId: attempt.id, status: attempt.status } as const;
    await tx.update(paymentAttempts).set({ status: "failed", failureReason, updatedAt: new Date() })
      .where(eq(paymentAttempts.id, attempt.id));
    return { paymentAttemptId: attempt.id, status: "failed" } as const;
  });
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
    if (!Number.isFinite(amount) || amount < MINIMUM_WITHDRAWAL_COINS) {
      throw new Error(`Minimum withdrawal is ${MINIMUM_WITHDRAWAL_COINS} Coins`);
    }
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

export async function getUserWithdrawals(userId: number, databaseOverride?: WorkflowDatabase) {
  const db = databaseOverride ?? await requireDb();
  return db.select({
    id: withdrawals.id,
    amount: withdrawals.amount,
    payoutMethod: withdrawals.payoutMethod,
    status: withdrawals.status,
    rejectionReason: withdrawals.rejectionReason,
    createdAt: withdrawals.createdAt,
    updatedAt: withdrawals.updatedAt,
  }).from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt));
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

const PROOF_MIME_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
function decodeProofImage(base64: string, mimeType: keyof typeof PROOF_MIME_TYPES) {
  const normalized = base64.replace(/^data:image\/(?:jpeg|png|webp);base64,/, "");
  const image = Buffer.from(normalized, "base64");
  const valid = (mimeType === "image/jpeg" && image.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) || (mimeType === "image/png" && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) || (mimeType === "image/webp" && image.subarray(0, 4).toString("ascii") === "RIFF" && image.subarray(8, 12).toString("ascii") === "WEBP");
  if (!normalized || image.length === 0 || image.length > 3 * 1024 * 1024 || !valid) throw new Error("Upload a valid JPG, PNG, or WebP screenshot up to 3 MB");
  return image;
}
export async function submitMatchResultProof(userId: number, input: { matchId: number; base64: string; mimeType: keyof typeof PROOF_MIME_TYPES; playerNote?: string }) {
  const image = decodeProofImage(input.base64, input.mimeType);
  const { url } = await storagePut(`match-result-proofs/${userId}/${input.matchId}/${randomUUID()}.${PROOF_MIME_TYPES[input.mimeType]}`, image, input.mimeType);
  return withinWorkflowTransaction(undefined, async (tx) => {
    const [participant] = await tx.select().from(matchParticipants).where(and(eq(matchParticipants.matchId, input.matchId), eq(matchParticipants.userId, userId))).limit(1).for("update");
    if (!participant) throw new Error("Join this match before submitting a result proof");
    const [match] = await tx.select({ status: matches.status }).from(matches).where(eq(matches.id, input.matchId)).limit(1);
    if (!match || !["active", "completed"].includes(match.status)) throw new Error("Result proof uploads open after the match begins");
    const [existing] = await tx.select().from(matchResultProofs).where(eq(matchResultProofs.participantId, participant.id)).limit(1).for("update");
    if (existing?.status === "approved") throw new Error("An approved proof cannot be replaced");
    const values = { matchId: input.matchId, participantId: participant.id, userId, imageUrl: url, playerNote: input.playerNote?.trim() || null, status: "pending" as const, reviewedBy: null, reviewNote: null, reviewedAt: null, updatedAt: new Date() };
    return existing ? (await tx.update(matchResultProofs).set(values).where(eq(matchResultProofs.id, existing.id)).returning())[0] : (await tx.insert(matchResultProofs).values(values).returning())[0];
  });
}
export async function getMyMatchResultProof(matchId: number, userId: number) { const db = await requireDb(); return (await db.select().from(matchResultProofs).where(and(eq(matchResultProofs.matchId, matchId), eq(matchResultProofs.userId, userId))).limit(1))[0] ?? null; }
export async function getAdminResultProofs() { const db = await requireDb(); return db.select({ proof: matchResultProofs, matchTitle: matches.matchTitle, playerName: sql<string>`COALESCE(${users.freeFireName}, ${users.name}, ${users.email}, 'Player')` }).from(matchResultProofs).innerJoin(matches, eq(matchResultProofs.matchId, matches.id)).innerJoin(users, eq(matchResultProofs.userId, users.id)).orderBy(desc(matchResultProofs.submittedAt)); }
export async function reviewMatchResultProof(proofId: number, adminUserId: number, status: "approved" | "rejected", reviewNote?: string) { const db = await requireDb(); const [proof] = await db.update(matchResultProofs).set({ status, reviewedBy: adminUserId, reviewNote: reviewNote?.trim() || null, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(matchResultProofs.id, proofId)).returning(); if (!proof) throw new Error("Result proof not found"); await db.insert(adminAuditLog).values({ action: "match_result_proof_reviewed", details: { proofId, adminUserId, status } }); return proof; }
export async function getLiveAnnouncements() { const db = await requireDb(); const now = new Date(); return db.select().from(announcements).where(and(eq(announcements.isActive, true), sql`(${announcements.startsAt} IS NULL OR ${announcements.startsAt} <= ${now})`, sql`(${announcements.endsAt} IS NULL OR ${announcements.endsAt} >= ${now})`)).orderBy(desc(announcements.createdAt)); }
export async function getAdminAnnouncements() { const db = await requireDb(); return db.select().from(announcements).orderBy(desc(announcements.createdAt)); }
export async function createAnnouncement(adminUserId: number, message: string, isActive: boolean) { const db = await requireDb(); const [item] = await db.insert(announcements).values({ message: message.trim(), isActive, createdBy: adminUserId }).returning(); await db.insert(adminAuditLog).values({ action: "announcement_created", details: { announcementId: item!.id, adminUserId } }); return item; }
export async function updateAnnouncement(adminUserId: number, id: number, message: string, isActive: boolean) { const db = await requireDb(); const [item] = await db.update(announcements).set({ message: message.trim(), isActive, updatedAt: new Date() }).where(eq(announcements.id, id)).returning(); if (!item) throw new Error("Announcement not found"); await db.insert(adminAuditLog).values({ action: "announcement_updated", details: { announcementId: id, adminUserId } }); return item; }
function indiaDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export async function getDailyCheckInStatus(userId: number) { const db = await requireDb(); const claimDate = indiaDate(); const [claim] = await db.select().from(dailyCheckIns).where(and(eq(dailyCheckIns.userId, userId), eq(dailyCheckIns.claimDate, claimDate))).limit(1); return { claimDate, claimed: Boolean(claim), rewardAmount: claim?.rewardAmount ?? null }; }
export async function claimDailyCheckIn(userId: number) { return withinWorkflowTransaction(undefined, async (tx) => { const claimDate = indiaDate(); const [claim] = await tx.select().from(dailyCheckIns).where(and(eq(dailyCheckIns.userId, userId), eq(dailyCheckIns.claimDate, claimDate))).limit(1).for("update"); if (claim) return { alreadyClaimed: true, rewardAmount: Number(claim.rewardAmount), claimDate }; const rewardAmount = Number(claimDate.slice(-2)) % 2 === 0 ? 2 : 1; await tx.insert(wallets).values({ userId, depositBalance: "0", winningBalance: "0", bonusBalance: "0" }).onConflictDoNothing({ target: wallets.userId }); await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} + ${rewardAmount}` }).where(eq(wallets.userId, userId)); await tx.insert(dailyCheckIns).values({ userId, claimDate, rewardAmount: rewardAmount.toFixed(2) }); await tx.insert(transactions).values({ userId, type: "daily_checkin", amount: rewardAmount.toFixed(2), balanceType: "bonus", status: "completed", description: `Daily check-in reward for ${claimDate}` }); return { alreadyClaimed: false, rewardAmount, claimDate }; }); }
