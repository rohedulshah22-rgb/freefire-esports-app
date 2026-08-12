import { Client } from "pg";
import { describe, expect, it } from "vitest";

describe("Neon PostgreSQL production connection", () => {
  it("connects with the configured connection string and executes a read-only query", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    expect(connectionString, "NEON_DATABASE_URL must be configured").toMatch(/^postgres(?:ql)?:\/\//);

    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: true },
    });

    try {
      await client.connect();
      const result = await client.query<{ connected: number }>("SELECT 1 AS connected");
      expect(result.rows[0]?.connected).toBe(1);

      const modes = await client.query<{ category: string; mode: string }>(`
        SELECT c."name" AS category, m."name" AS mode
        FROM "matchCategories" c
        INNER JOIN "matchModes" m ON m."categoryId" = c."id"
        ORDER BY c."name", m."name"
      `);
      expect(modes.rows).toEqual(expect.arrayContaining([
        { category: "BR", mode: "Solo" },
        { category: "BR", mode: "Duo" },
        { category: "BR", mode: "Squad" },
      ]));
    } finally {
      await client.end().catch(() => undefined);
    }
  }, 15_000);
});
