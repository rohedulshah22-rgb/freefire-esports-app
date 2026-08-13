import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";
import {
  cancelMatchAndRefund,
  getRoomCredentialsForJoinedPlayer,
  publishMatchRoomCredentials,
} from "./db";

describe("Admin active match management", () => {
  it("publishes room details and cancels a match with durable exactly-once player refunds", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    if (!connectionString) throw new Error("NEON_DATABASE_URL is required for Admin match-management coverage");
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
    await client.connect();
    await client.query("BEGIN");
    try {
      const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
      const categoryResult = await client.query<{ id: string }>(`INSERT INTO "matchCategories" (name, description) VALUES ($1, 'Admin management test') RETURNING id`, [`Admin-${suffix}`]);
      const categoryId = Number(categoryResult.rows[0]!.id);
      const modeResult = await client.query<{ id: string }>(`INSERT INTO "matchModes" ("categoryId", name, "teamSize", "maxPlayers", "entryFee") VALUES ($1, '1v1', 1, 2, 12.50) RETURNING id`, [categoryId]);
      const modeId = Number(modeResult.rows[0]!.id);
      const adminResult = await client.query<{ id: string }>(`INSERT INTO users ("openId", email, role) VALUES ($1, $2, 'admin') RETURNING id`, [`admin-${suffix}`, `admin-${suffix}@example.test`]);
      const playerAResult = await client.query<{ id: string }>(`INSERT INTO users ("openId", email) VALUES ($1, $2) RETURNING id`, [`player-a-${suffix}`, `player-a-${suffix}@example.test`]);
      const playerBResult = await client.query<{ id: string }>(`INSERT INTO users ("openId", email) VALUES ($1, $2) RETURNING id`, [`player-b-${suffix}`, `player-b-${suffix}@example.test`]);
      const adminUserId = Number(adminResult.rows[0]!.id);
      const playerAId = Number(playerAResult.rows[0]!.id);
      const playerBId = Number(playerBResult.rows[0]!.id);
      await client.query(`INSERT INTO wallets ("userId", "depositBalance", "winningBalance", "bonusBalance") VALUES ($1, 5, 0, 0), ($2, 8, 0, 0)`, [playerAId, playerBId]);
      const matchResult = await client.query<{ id: string }>(`INSERT INTO matches ("categoryId", "modeId", "matchTitle", "mapName", "scheduledStartTime", "scheduledEndTime", "credentialsVisibleAt", status, "entryFee", "totalSlots", "totalPrizePool", "perKillReward", "currentPlayers", "minPlayersRequired") VALUES ($1, $2, 'Admin Cancel Test', 'Bermuda', now() + interval '1 hour', now() + interval '2 hours', now() - interval '1 minute', 'scheduled', 12.50, 2, 25, 2, 2, 2) RETURNING id`, [categoryId, modeId]);
      const matchId = Number(matchResult.rows[0]!.id);
      await client.query(`INSERT INTO "matchParticipants" ("matchId", "userId", "entryFeeDeducted", status) VALUES ($1, $2, 12.50, 'joined'), ($1, $3, 12.50, 'joined')`, [matchId, playerAId, playerBId]);

      const db = drizzle(client, { schema });
      await publishMatchRoomCredentials(matchId, { roomId: "room-123", roomPassword: "secret-456" }, adminUserId, db);
      await expect(getRoomCredentialsForJoinedPlayer(matchId, playerAId, db)).resolves.toMatchObject({ available: true, roomId: "room-123", roomPassword: "secret-456" });

      const firstCancellation = await cancelMatchAndRefund(matchId, adminUserId, "Tournament cancelled by Admin", db);
      expect(firstCancellation).toMatchObject({ alreadyCancelled: false, refundedPlayers: 2, totalRefunded: 25 });
      const walletBalances = await client.query<{ userId: string; depositBalance: string }>(`SELECT "userId", "depositBalance" FROM wallets WHERE "userId" IN ($1, $2) ORDER BY "userId"`, [playerAId, playerBId]);
      expect(walletBalances.rows.map((wallet) => Number(wallet.depositBalance))).toEqual([17.5, 20.5]);
      const participantRefunds = await client.query<{ refundedAt: Date | null; refundAmount: string | null; status: string }>(`SELECT "refundedAt", "refundAmount", status FROM "matchParticipants" WHERE "matchId" = $1 ORDER BY "userId"`, [matchId]);
      expect(participantRefunds.rows).toHaveLength(2);
      expect(participantRefunds.rows.every((participant) => participant.status === "cancelled" && participant.refundedAt && Number(participant.refundAmount) === 12.5)).toBe(true);
      const refundTransactions = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM transactions WHERE "matchId" = $1 AND type = 'refund'`, [matchId]);
      expect(Number(refundTransactions.rows[0]!.count)).toBe(2);

      const repeatedCancellation = await cancelMatchAndRefund(matchId, adminUserId, "Tournament cancelled by Admin", db);
      expect(repeatedCancellation).toMatchObject({ alreadyCancelled: true, refundedPlayers: 0, totalRefunded: 0 });
      const refundsAfterRetry = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM transactions WHERE "matchId" = $1 AND type = 'refund'`, [matchId]);
      expect(Number(refundsAfterRetry.rows[0]!.count)).toBe(2);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  }, 20_000);

  it("keeps Active Matches, room publication, and cancellation actions behind Admin contracts in the dashboard", async () => {
    const [routerSource, dashboardSource] = await Promise.all([
      readFile(new URL("./routers.ts", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url), "utf8"),
    ]);
    expect(routerSource).toContain("getActiveMatches: adminProcedure.query");
    expect(routerSource).toContain("publishRoomCredentials: adminProcedure");
    expect(routerSource).toContain("cancelMatch: adminProcedure");
    expect(dashboardSource).toContain("Active Matches");
    expect(dashboardSource).toContain("Room ID");
    expect(dashboardSource).toContain("Room Password");
    expect(dashboardSource).toContain("Cancel Match & Auto-Refund");
    expect(dashboardSource).toContain("Confirm Cancel & Refund");
  });
});
