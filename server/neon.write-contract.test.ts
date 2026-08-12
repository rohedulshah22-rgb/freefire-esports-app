import { Client } from "pg";
import { describe, expect, it } from "vitest";

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
      await client.query(`
        INSERT INTO "withdrawals" ("userId", "amount", "payoutMethod", "payoutDetails", "status")
        VALUES ($1, 20, 'upi', 'contract@upi', 'pending')
      `, [userId]);
      await client.query(`
        INSERT INTO "transactions" ("userId", "type", "amount", "balanceType", "matchId", "status", "description")
        VALUES ($1, 'match_entry', -10, 'deposit', $2, 'completed', 'Rollback-only Neon contract validation')
      `, [userId, matchId]);

      const summary = await client.query<{ participants: string; deposits: string; withdrawals: string; transactions: string }>(`
        SELECT
          (SELECT COUNT(*) FROM "matchParticipants" WHERE "matchId" = $1) AS participants,
          (SELECT COUNT(*) FROM "deposits" WHERE "userId" = $2) AS deposits,
          (SELECT COUNT(*) FROM "withdrawals" WHERE "userId" = $2) AS withdrawals,
          (SELECT COUNT(*) FROM "transactions" WHERE "userId" = $2) AS transactions
      `, [matchId, userId]);
      expect(summary.rows[0]).toEqual({ participants: "1", deposits: "1", withdrawals: "1", transactions: "1" });
    } finally {
      if (transactionStarted) await client.query("ROLLBACK").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  }, 20_000);
});
