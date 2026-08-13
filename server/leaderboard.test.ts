import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterEach, describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";
import { getLeaderboard, getLeaderboardPeriodStart, getLeaderboardRankBadge } from "./db";

describe("leaderboard ranking rules", () => {
  it("assigns rank badges and selects correct temporal period starts", () => {
    expect(getLeaderboardRankBadge(1, "Pro Legend")).toBe("Podium Elite");
    expect(getLeaderboardRankBadge(10, "Pro Legend")).toBe("Pro Legend");
    expect(getLeaderboardRankBadge(22, "Pro Legend")).toBe("Rising Pro");
    expect(getLeaderboardPeriodStart("all", new Date())).toBeNull();
  });

  it("ranks current-period participant statistics without persisting test data", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    if (!connectionString) throw new Error("NEON_DATABASE_URL is required for leaderboard integration coverage");
    const client = new Client({ connectionString });
    const suffix = randomUUID().replaceAll("-", "");
    await client.connect();
    await client.query("BEGIN");
    try {
      const alice = await client.query<{ id: string }>(`INSERT INTO users ("openId", name, "freeFireName", role) VALUES ($1, 'Alice', 'Alpha', 'user') RETURNING id`, [`leaderboard-alice-${suffix}`]);
      const bob = await client.query<{ id: string }>(`INSERT INTO users ("openId", name, "freeFireName", role) VALUES ($1, 'Bob', 'Bravo', 'user') RETURNING id`, [`leaderboard-bob-${suffix}`]);
      const aliceId = Number(alice.rows[0]!.id);
      const bobId = Number(bob.rows[0]!.id);
      const category = await client.query<{ id: string }>(`INSERT INTO "matchCategories" (name) VALUES ($1) RETURNING id`, [`LB-${suffix}`]);
      const categoryId = Number(category.rows[0]!.id);
      const mode = await client.query<{ id: string }>(`INSERT INTO "matchModes" ("categoryId", name, "teamSize", "maxPlayers", "entryFee") VALUES ($1, 'Solo', 1, 100, 0) RETURNING id`, [categoryId]);
      const modeId = Number(mode.rows[0]!.id);
      const match = await client.query<{ id: string }>(`INSERT INTO matches ("categoryId", "modeId", "matchTitle", "mapName", "scheduledStartTime", "entryFee", "totalSlots", "totalPrizePool", "perKillReward", "minPlayersRequired") VALUES ($1, $2, 'Leaderboard Test', 'Bermuda', now(), 0, 100, 0, 0, 1) RETURNING id`, [categoryId, modeId]);
      const matchId = Number(match.rows[0]!.id);
      const historicMatch = await client.query<{ id: string }>(`INSERT INTO matches ("categoryId", "modeId", "matchTitle", "mapName", "scheduledStartTime", "entryFee", "totalSlots", "totalPrizePool", "perKillReward", "minPlayersRequired") VALUES ($1, $2, 'Leaderboard History Test', 'Bermuda', now() - interval '10 days', 0, 100, 0, 0, 1) RETURNING id`, [categoryId, modeId]);
      const historicMatchId = Number(historicMatch.rows[0]!.id);
      await client.query(`INSERT INTO "matchParticipants" ("matchId", "userId", status, "killCount", "prizeAwarded", "entryFeeDeducted", "updatedAt") VALUES ($1, $2, 'completed', 7, 10, 0, now()), ($1, $3, 'completed', 2, 25, 0, now()), ($4, $3, 'completed', 99, 500, 0, now() - interval '10 days')`, [matchId, aliceId, bobId, historicMatchId]);
      await client.query(`INSERT INTO "leaderboardSettings" (id, "weeklyCycleStartedAt") VALUES (1, now() - interval '2 days') ON CONFLICT (id) DO UPDATE SET "weeklyCycleStartedAt" = EXCLUDED."weeklyCycleStartedAt"`);
      const db = drizzle(client, { schema });

      const weeklyKills = await getLeaderboard(aliceId, { metric: "kills", period: "weekly" }, db);
      expect(weeklyKills.entries[0]).toMatchObject({ userId: aliceId, username: "Alpha", totalKills: 7, rank: 1 });
      expect(weeklyKills.myEntry).toMatchObject({ rank: 1, rankBadge: "Podium Elite" });

      const allEarnings = await getLeaderboard(bobId, { metric: "earnings", period: "all" }, db);
      expect(allEarnings.entries[0]).toMatchObject({ userId: bobId, totalEarnings: 525, rank: 1 });
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  }, 20_000);
});
