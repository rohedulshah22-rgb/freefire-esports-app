import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";
import { getPublicMatchById } from "./db";

describe("custom game-mode tags and rules", () => {
  it("persists player-visible tag and rules metadata through the public match-detail contract", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    if (!connectionString) throw new Error("NEON_DATABASE_URL is required for custom match-mode coverage");
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
    await client.connect();
    await client.query("BEGIN");
    try {
      const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
      const category = await client.query<{ id: string }>(`INSERT INTO "matchCategories" (name, description) VALUES ($1, 'Custom tag test') RETURNING id`, [`Test-${suffix}`]);
      const categoryId = Number(category.rows[0]!.id);
      const mode = await client.query<{ id: string }>(`INSERT INTO "matchModes" ("categoryId", name, "teamSize", "maxPlayers", "entryFee") VALUES ($1, '1v1', 1, 2, 10) RETURNING id`, [categoryId]);
      const modeId = Number(mode.rows[0]!.id);
      const match = await client.query<{ id: string }>(`INSERT INTO matches ("categoryId", "modeId", "matchTitle", "mapName", "customModeTag", "rulesSummary", "scheduledStartTime", "entryFee", "totalSlots", "totalPrizePool", "perKillReward", "minPlayersRequired") VALUES ($1, $2, 'Custom Rules Match', 'Bermuda', 'CS Headshot Only', 'UMP only · No grenades', now() + interval '1 day', 10, 2, 20, 2, 2) RETURNING id`, [categoryId, modeId]);
      const db = drizzle(client, { schema });
      const contract = await getPublicMatchById(Number(match.rows[0]!.id), db);
      expect(contract?.match.customModeTag).toBe("CS Headshot Only");
      expect(contract?.match.rulesSummary).toBe("UMP only · No grenades");
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  }, 20_000);

  it("exposes custom tags, rule summaries, and a transparent Admin profit preview in the intended UI contracts", async () => {
    const [admin, home, detail, router, schemaSource] = await Promise.all([
      readFile(new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/MatchDetail.tsx", import.meta.url), "utf8"),
      readFile(new URL("./routers.ts", import.meta.url), "utf8"),
      readFile(new URL("../drizzle/schema.ts", import.meta.url), "utf8"),
    ]);
    expect(admin).toContain("Custom Game Mode Tag");
    expect(admin).toContain("Player Rule Summary");
    expect(admin).toContain("Admin Profit Margin");
    expect(admin).toContain("projectedAdminProfit");
    expect(home).toContain("customModeTag");
    expect(home).toContain("rulesSummary");
    expect(detail).toContain("Custom Mode Rules");
    expect(router).toContain("customModeTag: z.string().trim().min(2).max(80).optional()");
    expect(router).toContain("rulesSummary: z.string().trim().min(2).max(1_000).optional()");
    expect(schemaSource).toContain('customModeTag: varchar("customModeTag", { length: 80 })');
    expect(schemaSource).toContain('rulesSummary: text("rulesSummary")');
  });
});
