import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";
import { getPlayerProfile } from "./db";

describe("player avatar and numeric UID profile support", () => {
  it("assigns a persistent numeric player UID to an existing player profile without persisting test data", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    if (!connectionString) throw new Error("NEON_DATABASE_URL is required for profile integration coverage");
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
    await client.connect();
    await client.query("BEGIN");
    try {
      const suffix = randomUUID().replaceAll("-", "");
      const inserted = await client.query<{ id: string }>(`INSERT INTO users ("openId", name, role) VALUES ($1, 'Avatar Test Player', 'user') RETURNING id`, [`avatar-profile-${suffix}`]);
      const userId = Number(inserted.rows[0]!.id);
      const db = drizzle(client, { schema });

      const profile = await getPlayerProfile(userId, db);
      expect(profile.user.playerUid).toBe(String(8_000_000_000 + userId));
      expect(profile.user.playerUid).toMatch(/^\d+$/);
      const readback = await client.query<{ playerUid: string }>(`SELECT "playerUid" FROM users WHERE id = $1`, [userId]);
      expect(readback.rows[0]!.playerUid).toBe(profile.user.playerUid);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  }, 20_000);

  it("keeps avatar selection scoped to the authenticated profile and retains the Free Fire UID editor", async () => {
    const profileSource = await readFile(new URL("../client/src/pages/Profile.tsx", import.meta.url), "utf8");
    const routerSource = await readFile(new URL("./routers.ts", import.meta.url), "utf8");
    expect(profileSource).toContain('aria-label="Upload or change profile avatar"');
    expect(profileSource).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(profileSource).toContain("updateAvatar.mutate");
    expect(profileSource).toContain("UID: {profile.user.playerUid}");
    expect(profileSource).toContain("Free Fire UID: {profile.freeFireUid || \"Not set\"}");
    expect(profileSource).toContain("Edit Free Fire ID");
    expect(routerSource).toContain("updateAvatar: protectedProcedure");
    expect(routerSource).toContain("updatePlayerAvatar(ctx.user.id, input)");
    expect(routerSource).not.toContain("updatePlayerAvatar(input.userId");
  });
});
