import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";
import { getAdminFinancialSummary, registerPlayerDevice } from "./db";

describe("BooyahCraft finishing features", () => {
  it("flags a shared device without overwriting an existing account and totals only approved deposits and completed withdrawals", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    if (!connectionString) throw new Error("NEON_DATABASE_URL is required for finishing-feature coverage");
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
    await client.connect();
    await client.query("BEGIN");
    try {
      const suffix = randomUUID().replaceAll("-", "");
      const first = await client.query<{ id: string }>(`INSERT INTO users ("openId", name, role) VALUES ($1, 'Device Owner', 'user') RETURNING id`, [`device-owner-${suffix}`]);
      const second = await client.query<{ id: string }>(`INSERT INTO users ("openId", name, role) VALUES ($1, 'Second Device User', 'user') RETURNING id`, [`device-second-${suffix}`]);
      const firstId = Number(first.rows[0]!.id);
      const secondId = Number(second.rows[0]!.id);
      const db = drizzle(client, { schema });
      const utrOne = `${Date.now()}`.slice(-12).padStart(12, "0");
      const utrTwo = `${Date.now() + 1}`.slice(-12).padStart(12, "0");

      await expect(registerPlayerDevice(firstId, `shared-device-${suffix}`, db)).resolves.toMatchObject({ registered: true, sharedDevice: false });
      await expect(registerPlayerDevice(secondId, `shared-device-${suffix}`, db)).resolves.toMatchObject({ registered: false, sharedDevice: true });

      await client.query(`INSERT INTO deposits ("userId", amount, "utrNumber", status) VALUES ($1, 125, $2, 'approved'), ($1, 50, $3, 'pending')`, [firstId, utrOne, utrTwo]);
      await client.query(`INSERT INTO withdrawals ("userId", amount, "payoutMethod", "payoutDetails", status) VALUES ($1, 30, 'upi', 'device@upi', 'completed'), ($1, 20, 'upi', 'pending@upi', 'pending')`, [firstId]);
      await expect(getAdminFinancialSummary(db)).resolves.toEqual({ totalApprovedDeposits: 125, totalCompletedWithdrawals: 30 });
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  }, 20_000);

  it("renders live match countdown, prize breakdown, account device registration, and Admin financial summary intent", async () => {
    const [home, detail, admin, router] = await Promise.all([
      readFile(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/MatchDetail.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url), "utf8"),
      readFile(new URL("./routers.ts", import.meta.url), "utf8"),
    ]);
    expect(home).toContain("window.setInterval");
    expect(home).toContain("Starts in {countdownLabel}");
    expect(home).toContain("secondsUntilStart");
    expect(home).toContain("trpc.security.registerDevice.useMutation");
    expect(detail).toContain("Per Kill");
    expect(detail).toContain("Win Prize");
    expect(detail).toContain("winnerRule");
    expect(admin).toContain("Financial Summary");
    expect(admin).toContain("Total Deposits");
    expect(admin).toContain("Total Withdrawals");
    expect(router).toContain("registerDevice: protectedProcedure");
    expect(router).toContain("getAdminFinancialSummary()");
  });
});
