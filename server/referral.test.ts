import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterEach, describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";
import {
  enrollReferralCode,
  getReferralDashboard,
  settleReferralRewardAfterFirstMatchJoin,
} from "./db";

const openClients: Client[] = [];

afterEach(async () => {
  await Promise.all(openClients.splice(0).map(async (client) => {
    try { await client.query("ROLLBACK"); } catch { /* transaction already closed */ }
    await client.end();
  }));
});

async function openRollbackDatabase() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) throw new Error("NEON_DATABASE_URL is required for referral integration coverage");
  const client = new Client({ connectionString });
  await client.connect();
  openClients.push(client);
  await client.query("BEGIN");
  await client.query('INSERT INTO "referralSettings" (id, "isEnabled", "referrerBonusAmount", "refereeBonusAmount") VALUES (1, TRUE, 5, 5) ON CONFLICT (id) DO UPDATE SET "isEnabled" = TRUE, "referrerBonusAmount" = 5, "refereeBonusAmount" = 5');
  return { client, db: drizzle(client, { schema }) };
}

async function createPlayer(client: Client, suffix: string, label: string) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO users ("openId", name, role) VALUES ($1, $2, 'user') RETURNING id`,
    [`referral-${label}-${suffix}`, label],
  );
  return Number(result.rows[0]!.id);
}

describe("Refer & Earn workflow", () => {
  it("enrolls a valid invited player once, rejects self-referrals, and blocks reused-device rewards", async () => {
    const { client, db } = await openRollbackDatabase();
    const suffix = randomUUID().replaceAll("-", "");
    const referrerId = await createPlayer(client, suffix, "Referrer");
    const inviteeId = await createPlayer(client, suffix, "Invitee");
    const selfId = await createPlayer(client, suffix, "Self");
    const blockedId = await createPlayer(client, suffix, "Blocked");

    const referrerDashboard = await getReferralDashboard(referrerId, { deviceToken: "referrer-device-123", requestOrigin: "198.51.100.1" }, db);
    const applied = await enrollReferralCode(inviteeId, referrerDashboard.referralCode, { deviceToken: "invitee-device-456", requestOrigin: "198.51.100.2" }, db);
    expect(applied).toMatchObject({ status: "pending", blocked: false });

    await expect(enrollReferralCode(inviteeId, referrerDashboard.referralCode, { deviceToken: "other-device-789" }, db)).rejects.toThrow("already been applied");

    const selfDashboard = await getReferralDashboard(selfId, { deviceToken: "self-device-321", requestOrigin: "198.51.100.3" }, db);
    await expect(enrollReferralCode(selfId, selfDashboard.referralCode, { deviceToken: "self-device-321", requestOrigin: "198.51.100.3" }, db)).rejects.toThrow("cannot apply your own");

    const blocked = await enrollReferralCode(blockedId, referrerDashboard.referralCode, { deviceToken: "referrer-device-123", requestOrigin: "198.51.100.4" }, db);
    expect(blocked).toMatchObject({ status: "blocked", blocked: true });
  }, 35_000);

  it("credits both referral bonuses exactly once after the invited player’s first match join", async () => {
    const { client, db } = await openRollbackDatabase();
    const suffix = randomUUID().replaceAll("-", "");
    const referrerId = await createPlayer(client, suffix, "RewardReferrer");
    const inviteeId = await createPlayer(client, suffix, "RewardInvitee");
    const dashboard = await getReferralDashboard(referrerId, { deviceToken: "reward-referrer-device", requestOrigin: "203.0.113.1" }, db);
    await enrollReferralCode(inviteeId, dashboard.referralCode, { deviceToken: "reward-invitee-device", requestOrigin: "203.0.113.2" }, db);

    const category = await client.query<{ id: string }>('INSERT INTO "matchCategories" (name) VALUES ($1) RETURNING id', [`REF-${suffix}`]);
    const mode = await client.query<{ id: string }>('INSERT INTO "matchModes" ("categoryId", name, "teamSize", "maxPlayers", "entryFee") VALUES ($1, $2, 1, 2, 0) RETURNING id', [Number(category.rows[0]!.id), "Solo"]);
    const match = await client.query<{ id: string }>('INSERT INTO matches ("categoryId", "modeId", "matchTitle", "mapName", "scheduledStartTime", "entryFee", "totalSlots", "totalPrizePool", "perKillReward", "minPlayersRequired") VALUES ($1, $2, $3, $4, now(), 0, 2, 0, 0, 1) RETURNING id', [Number(category.rows[0]!.id), Number(mode.rows[0]!.id), "Referral Reward Match", "Bermuda"]);
    await client.query('INSERT INTO "matchParticipants" ("matchId", "userId", status, "entryFeeDeducted") VALUES ($1, $2, $3, 0)', [Number(match.rows[0]!.id), inviteeId, "joined"]);

    const firstSettlement = await settleReferralRewardAfterFirstMatchJoin(inviteeId, db);
    const repeatSettlement = await settleReferralRewardAfterFirstMatchJoin(inviteeId, db);
    expect(firstSettlement).toMatchObject({ rewarded: true, referrerId, referredUserId: inviteeId });
    expect(repeatSettlement).toMatchObject({ rewarded: false, reason: "rewarded" });

    const balances = await client.query<{ userId: string; bonusBalance: string }>('SELECT "userId", "bonusBalance" FROM wallets WHERE "userId" = ANY($1::int[]) ORDER BY "userId"', [[referrerId, inviteeId]]);
    expect(balances.rows).toEqual([
      { userId: String(Math.min(referrerId, inviteeId)), bonusBalance: "5.00" },
      { userId: String(Math.max(referrerId, inviteeId)), bonusBalance: "5.00" },
    ]);
    const bonusTransactions = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM transactions WHERE "referralId" IS NOT NULL`);
    expect(bonusTransactions.rows[0]!.count).toBe("2");
  }, 35_000);

  it("keeps Refer & Earn player guidance, Home navigation, and owner-admin UI intent connected to the protected referral contracts", async () => {
    const [profileSource, homeSource, adminSource] = await Promise.all([
      readFile(new URL("../client/src/pages/Profile.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url), "utf8"),
    ]);
    expect(profileSource).toContain("trpc.referrals.dashboard.useQuery");
    expect(profileSource).toContain("trpc.referrals.applyCode.useMutation");
    expect(profileSource).toContain("How It Works & Benefits");
    expect(profileSource).toContain("Referral Rules & Terms");
    expect(profileSource).toContain("Matching device or request-origin signals automatically block");
    expect(homeSource).toContain("Dual Bonus Rewards");
    expect(homeSource).toContain('window.location.href = "/profile#refer-earn"');
    expect(adminSource).toContain('TabsTrigger value="referrals"');
    expect(adminSource).toContain("trpc.referrals.updateSettings.useMutation");
    expect(adminSource).toContain("Fraud Blocked");
  });
});
