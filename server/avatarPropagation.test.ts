import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";
import { getLeaderboard, getMatchParticipants } from "./db";

describe("cross-app player avatar propagation", () => {
  it("returns the saved avatar URL in leaderboard and participant contracts without persisting test data", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    if (!connectionString) throw new Error("NEON_DATABASE_URL is required for avatar propagation coverage");
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
    await client.connect();
    await client.query("BEGIN");
    try {
      const suffix = randomUUID().replaceAll("-", "");
      const avatarUrl = `/manus-storage/avatar-propagation-${suffix}.png`;
      const user = await client.query<{ id: string }>(`INSERT INTO users ("openId", name, "freeFireName", "avatarUrl", role) VALUES ($1, 'Avatar Player', 'Avatar IGN', $2, 'user') RETURNING id`, [`avatar-propagation-${suffix}`, avatarUrl]);
      const userId = Number(user.rows[0]!.id);
      const category = await client.query<{ id: string }>(`INSERT INTO "matchCategories" (name) VALUES ($1) RETURNING id`, [`Avatar Category ${suffix}`]);
      const categoryId = Number(category.rows[0]!.id);
      const mode = await client.query<{ id: string }>(`INSERT INTO "matchModes" ("categoryId", name, "teamSize", "maxPlayers", "entryFee") VALUES ($1, 'Solo', 1, 48, 0) RETURNING id`, [categoryId]);
      const modeId = Number(mode.rows[0]!.id);
      const match = await client.query<{ id: string }>(`INSERT INTO matches ("categoryId", "modeId", "matchTitle", "mapName", "scheduledStartTime", "entryFee", "totalSlots", "totalPrizePool", "perKillReward", "minPlayersRequired") VALUES ($1, $2, 'Avatar Propagation Test', 'Bermuda', now() + interval '1 day', 0, 48, 0, 0, 1) RETURNING id`, [categoryId, modeId]);
      const matchId = Number(match.rows[0]!.id);
      await client.query(`INSERT INTO "matchParticipants" ("matchId", "userId", "freeFireIGN", "freeFireUID", "entryFeeDeducted", status, "killCount", "prizeAwarded") VALUES ($1, $2, 'Avatar IGN', '123456789', 0, 'completed', 4, 12)`, [matchId, userId]);
      const db = drizzle(client, { schema });

      const participants = await getMatchParticipants(matchId, db);
      expect(participants[0]).toMatchObject({ userId, username: "Avatar IGN", avatarUrl });
      const leaderboard = await getLeaderboard(userId, { metric: "kills", period: "all" }, db);
      expect(leaderboard.entries.find((entry) => entry.userId === userId)).toMatchObject({ avatarUrl, username: "Avatar IGN" });
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  }, 20_000);

  it("renders custom avatars with initials fallbacks in player and Admin rankings and participant lists", async () => {
    const [leaderboardSource, detailSource, adminSource, routerSource] = await Promise.all([
      readFile(new URL("../client/src/pages/Leaderboard.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/MatchDetail.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url), "utf8"),
      readFile(new URL("./routers.ts", import.meta.url), "utf8"),
    ]);
    expect(leaderboardSource).toContain("function RankingAvatar");
    expect(leaderboardSource).toContain("entry.avatarUrl ? <img");
    expect(leaderboardSource).toContain("<RankingAvatar entry={entry} />");
    expect(detailSource).toContain("trpc.matches.getParticipants.useQuery");
    expect(detailSource).toContain("participant.avatarUrl ? <img");
    expect(detailSource).toContain("participantInitials(participant.username)");
    expect(adminSource).toContain("trpc.matches.getParticipants.useQuery");
    expect(adminSource).toContain("participant.avatarUrl ? <img");
    expect(routerSource).toContain("getParticipants: publicProcedure");
  });
});
