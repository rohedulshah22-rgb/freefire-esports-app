import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "../drizzle/schema";
import {
  getPublicMatchById,
  getRoomCredentialsForJoinedPlayer,
  getPlayerProfile,
  joinMatch,
  processWithdrawalRequest,
  requestWithdrawal,
  updatePlayerProfile,
} from "./db";

describe("Neon PostgreSQL write contracts", () => {
  it("validates tournament, wallet, deposit, withdrawal, and transaction writes in a rolled-back transaction", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    expect(connectionString, "NEON_DATABASE_URL must be configured").toMatch(/^postgres(?:ql)?:\/\//);

    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: true },
    });
    const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    let transactionStarted = false;

    try {
      await client.connect();
      await client.query("BEGIN");
      transactionStarted = true;

      const userResult = await client.query<{ id: number }>(`
        INSERT INTO "users" ("openId", "name", "role")
        VALUES ($1, $2, 'user')
        RETURNING "id"
      `, [`neon-contract-${uniqueSuffix}`, "Neon contract check"]);
      const userId = Number(userResult.rows[0]?.id);
      expect(Number.isSafeInteger(userId)).toBe(true);

      await client.query(`
        INSERT INTO "wallets" ("userId", "depositBalance", "winningBalance", "bonusBalance")
        VALUES ($1, 100, 50, 5)
      `, [userId]);

      const modeResult = await client.query<{ categoryId: number; modeId: number }>(`
        SELECT c."id" AS "categoryId", m."id" AS "modeId"
        FROM "matchCategories" c
        INNER JOIN "matchModes" m ON m."categoryId" = c."id"
        WHERE c."name" = 'BR' AND m."name" = 'Solo'
        LIMIT 1
      `);
      const mode = modeResult.rows[0];
      expect(mode).toBeDefined();

      const matchResult = await client.query<{ id: number }>(`
        INSERT INTO "matches" (
          "categoryId", "modeId", "matchTitle", "mapName", "scheduledStartTime", "scheduledEndTime",
          "credentialsVisibleAt", "status", "entryFee", "totalSlots", "totalPrizePool", "perKillReward",
          "adminProfitDeducted", "currentPlayers", "minPlayersRequired", "refundProcessed"
        ) VALUES (
          $1, $2, $3, 'Bermuda', CURRENT_TIMESTAMP + INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '2 hours',
          CURRENT_TIMESTAMP + INTERVAL '45 minutes', 'scheduled', 10, 48, 384, 2, 76.8, 0, 10, false
        )
        RETURNING "id"
      `, [mode!.categoryId, mode!.modeId, `Neon contract match ${uniqueSuffix}`]);
      const matchId = Number(matchResult.rows[0]?.id);
      expect(Number.isSafeInteger(matchId)).toBe(true);

      await client.query(`
        UPDATE "wallets"
        SET "depositBalance" = "depositBalance" - 10
        WHERE "userId" = $1 AND "depositBalance" >= 10
      `, [userId]);
      await client.query(`
        INSERT INTO "matchParticipants" ("matchId", "userId", "freeFireIGN", "freeFireUID", "entryFeeDeducted", "status")
        VALUES ($1, $2, 'ContractIGN', '123456789012', 10, 'joined')
      `, [matchId, userId]);
      await client.query(`
        INSERT INTO "deposits" ("userId", "amount", "utrNumber", "status")
        VALUES ($1, 50, $2, 'pending')
      `, [userId, uniqueSuffix.slice(-12).padStart(12, "0")]);
      const withdrawalResult = await client.query<{ id: number }>(`
        INSERT INTO "withdrawals" ("userId", "amount", "payoutMethod", "payoutDetails", "status")
        VALUES ($1, 20, 'upi', 'contract@upi', 'pending')
        RETURNING "id"
      `, [userId]);
      const withdrawalId = Number(withdrawalResult.rows[0]?.id);
      expect(Number.isSafeInteger(withdrawalId)).toBe(true);
      await client.query(`
        INSERT INTO "transactions" ("userId", "type", "amount", "balanceType", "matchId", "status", "description")
        VALUES ($1, 'match_entry', -10, 'deposit', $2, 'completed', 'Rollback-only Neon contract validation')
      `, [userId, matchId]);

      // Withdrawal queue contract: reserve Winning Balance, then refund it when an admin rejects the request.
      await client.query(`
        UPDATE "wallets" SET "winningBalance" = "winningBalance" - 20
        WHERE "userId" = $1 AND "winningBalance" >= 20
      `, [userId]);
      await client.query(`
        INSERT INTO "transactions" ("userId", "type", "amount", "balanceType", "withdrawalId", "status", "description")
        VALUES ($1, 'withdrawal', -20, 'winning', $2, 'pending', 'Withdrawal queue contract validation')
      `, [userId, withdrawalId]);
      await client.query(`
        UPDATE "withdrawals" SET "status" = 'rejected', "rejectionReason" = 'Rollback test', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1 AND "status" = 'pending'
      `, [withdrawalId]);
      await client.query(`
        UPDATE "wallets" SET "winningBalance" = "winningBalance" + 20 WHERE "userId" = $1
      `, [userId]);
      await client.query(`
        INSERT INTO "transactions" ("userId", "type", "amount", "balanceType", "withdrawalId", "status", "description")
        VALUES ($1, 'withdrawal', 20, 'winning', $2, 'cancelled', 'Withdrawal rejected and refunded')
      `, [userId, withdrawalId]);

      const summary = await client.query<{ participants: string; deposits: string; withdrawals: string; transactions: string }>(`
        SELECT
          (SELECT COUNT(*) FROM "matchParticipants" WHERE "matchId" = $1) AS participants,
          (SELECT COUNT(*) FROM "deposits" WHERE "userId" = $2) AS deposits,
          (SELECT COUNT(*) FROM "withdrawals" WHERE "userId" = $2) AS withdrawals,
          (SELECT COUNT(*) FROM "transactions" WHERE "userId" = $2) AS transactions
      `, [matchId, userId]);
      expect(summary.rows[0]).toEqual({ participants: "1", deposits: "1", withdrawals: "1", transactions: "3" });
      const walletAndQueue = await client.query<{ depositBalance: string; winningBalance: string; status: string }>(`
        SELECT w."depositBalance", w."winningBalance", wd."status"
        FROM "wallets" w
        INNER JOIN "withdrawals" wd ON wd."userId" = w."userId"
        WHERE w."userId" = $1 AND wd."id" = $2
      `, [userId, withdrawalId]);
      expect(walletAndQueue.rows[0]).toEqual({ depositBalance: "90.00", winningBalance: "50.00", status: "rejected" });
    } finally {
      if (transactionStarted) await client.query("ROLLBACK").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  }, 20_000);

  it("runs the real workflow helpers in a rolled-back Neon transaction", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    expect(connectionString, "NEON_DATABASE_URL must be configured").toMatch(/^postgres(?:ql)?:\/\//);

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
    const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    let transactionStarted = false;
    try {
      await client.connect();
      await client.query("BEGIN");
      transactionStarted = true;
      const db = drizzle(client, { schema });

      const joinedUser = await client.query<{ id: string }>(`
        INSERT INTO "users" ("openId", "name", "role") VALUES ($1, 'Workflow Player', 'user') RETURNING "id"
      `, [`workflow-joined-${uniqueSuffix}`]);
      const otherUser = await client.query<{ id: string }>(`
        INSERT INTO "users" ("openId", "name", "role") VALUES ($1, 'Other Player', 'user') RETURNING "id"
      `, [`workflow-other-${uniqueSuffix}`]);
      const joinedUserId = Number(joinedUser.rows[0]!.id);
      const otherUserId = Number(otherUser.rows[0]!.id);
      await client.query(`
        INSERT INTO "wallets" ("userId", "depositBalance", "winningBalance", "bonusBalance") VALUES ($1, 7, 50, 3)
      `, [joinedUserId]);

      const mode = await client.query<{ categoryId: string; modeId: string }>(`
        SELECT c."id" AS "categoryId", m."id" AS "modeId"
        FROM "matchCategories" c INNER JOIN "matchModes" m ON m."categoryId" = c."id"
        WHERE c."name" = 'BR' AND m."name" = 'Solo' LIMIT 1
      `);
      const matchResult = await client.query<{ id: string }>(`
        INSERT INTO "matches" (
          "categoryId", "modeId", "matchTitle", "mapName", "scheduledStartTime", "scheduledEndTime", "credentialsVisibleAt",
          "roomId", "roomPassword", "status", "entryFee", "totalSlots", "totalPrizePool", "perKillReward",
          "adminProfitDeducted", "currentPlayers", "minPlayersRequired", "refundProcessed"
        ) VALUES ($1, $2, $3, 'Bermuda', CURRENT_TIMESTAMP + INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '2 hours',
          CURRENT_TIMESTAMP - INTERVAL '1 minute', 'secure-room', 'secure-password', 'scheduled', 10, 48, 384, 2, 0, 0, 1, false
        ) RETURNING "id"
      `, [mode.rows[0]!.categoryId, mode.rows[0]!.modeId, `Workflow match ${uniqueSuffix}`]);
      const matchId = Number(matchResult.rows[0]!.id);

      const publicMatch = await getPublicMatchById(matchId, db);
      expect(publicMatch?.match).not.toHaveProperty("roomId");
      await expect(getRoomCredentialsForJoinedPlayer(matchId, otherUserId, db)).rejects.toThrow("Join this match");

      const joinResult = await joinMatch(matchId, joinedUserId, "WorkflowIGN", "123456789012", db);
      expect(joinResult).toMatchObject({ deductedFromDeposit: 7, deductedFromBonus: 3, matchId });
      const visibleCredentials = await getRoomCredentialsForJoinedPlayer(matchId, joinedUserId, db);
      expect(visibleCredentials).toMatchObject({ available: true, roomId: "secure-room", roomPassword: "secure-password" });

      const updatedProfile = await updatePlayerProfile(joinedUserId, { freeFireName: "Updated Workflow IGN", freeFireUid: "987654321012" }, db);
      expect(updatedProfile).toMatchObject({ freeFireName: "Updated Workflow IGN", freeFireUid: "987654321012", totalMatches: 1, totalKills: 0 });
      const profileReadback = await getPlayerProfile(joinedUserId, db);
      expect(profileReadback.freeFireUid).toBe("987654321012");

      const withdrawal = await requestWithdrawal(joinedUserId, 20, "upi", "workflow@upi", db);
      await processWithdrawalRequest(withdrawal.withdrawalId, "rejected", "Rollback test", db);
      const state = await client.query<{ depositBalance: string; bonusBalance: string; winningBalance: string; status: string; participants: string }>(`
        SELECT w."depositBalance", w."bonusBalance", w."winningBalance", wd."status",
          (SELECT COUNT(*) FROM "matchParticipants" WHERE "matchId" = $2) AS participants
        FROM "wallets" w INNER JOIN "withdrawals" wd ON wd."userId" = w."userId"
        WHERE w."userId" = $1 AND wd."id" = $3
      `, [joinedUserId, matchId, withdrawal.withdrawalId]);
      expect(state.rows[0]).toEqual({ depositBalance: "0.00", bonusBalance: "0.00", winningBalance: "50.00", status: "rejected", participants: "1" });
    } finally {
      if (transactionStarted) await client.query("ROLLBACK").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  }, 20_000);
});
