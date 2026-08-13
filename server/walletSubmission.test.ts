import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(id: number, suffix: string): AuthenticatedUser {
  const now = new Date();
  return {
    id,
    openId: `wallet-router-${suffix}`,
    name: "Wallet Router Test Player",
    email: null,
    freeFireName: null,
    freeFireUid: null,
    loginMethod: "test",
    role: "user",
    deviceId: null,
    isAndroidMobile: true,
    isBanned: false,
    banReason: null,
    referralCode: null,
    referredBy: null,
    referralBonusAwarded: false,
    adminUsername: null,
    adminPasswordHash: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

async function withRollbackTransaction(
  operation: (args: { client: Client; ctx: TrpcContext; userId: number }) => Promise<void>,
) {
  const connectionString = process.env.NEON_DATABASE_URL;
  expect(connectionString, "NEON_DATABASE_URL must be configured").toMatch(/^postgres(?:ql)?:\/\//);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
  let transactionStarted = false;
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;

  try {
    await client.connect();
    await client.query("BEGIN");
    transactionStarted = true;
    const userIdResult = await client.query<{ id: string }>(
      `INSERT INTO "users" ("openId", "name", "loginMethod", "role") VALUES ($1, $2, 'test', 'user') RETURNING "id"`,
      [`wallet-router-${suffix}`, "Wallet Router Test Player"],
    );
    const userId = Number(userIdResult.rows[0]!.id);
    const databaseOverride = drizzle(client, { schema });
    const ctx: TrpcContext = {
      user: createUser(userId, suffix),
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
      databaseOverride,
    };

    await operation({ client, ctx, userId });
  } finally {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}

describe("wallet submission routers", () => {
  it("creates a pending deposit request through wallet.addMoney without persisting test data", async () => {
    await withRollbackTransaction(async ({ client, ctx, userId }) => {
      const result = await appRouter.createCaller(ctx).wallet.addMoney({
        amount: "50",
        utrNumber: "123456789012",
      });

      expect(result).toMatchObject({ success: true });
      expect(result.depositId).toEqual(expect.any(Number));
      const deposit = await client.query<{ userId: string; amount: string; utrNumber: string; status: string }>(
        `SELECT "userId", "amount", "utrNumber", "status" FROM "deposits" WHERE "id" = $1`,
        [result.depositId],
      );
      expect(deposit.rows).toEqual([{
        userId: String(userId),
        amount: "50.00",
        utrNumber: "123456789012",
        status: "pending",
      }]);
    });
  }, 20_000);

  it("queues a 50-Coin Winning Balance withdrawal, exposes only the player history, and rejects invalid amounts", async () => {
    await withRollbackTransaction(async ({ client, ctx, userId }) => {
      await client.query(
        `INSERT INTO "wallets" ("userId", "depositBalance", "winningBalance", "bonusBalance") VALUES ($1, 10, 100, 5)`,
        [userId],
      );
      const caller = appRouter.createCaller(ctx);
      const result = await caller.wallet.withdraw({
        amount: "50",
        payoutMethod: "upi",
        payoutDetails: "wallet-router@upi",
      });

      expect(result).toMatchObject({ success: true });
      const state = await client.query<{
        winningBalance: string;
        amount: string;
        payoutMethod: string;
        payoutDetails: string;
        status: string;
        transactionAmount: string;
        balanceType: string;
      }>(`
        SELECT w."winningBalance", wd."amount", wd."payoutMethod", wd."payoutDetails", wd."status",
          t."amount" AS "transactionAmount", t."balanceType"
        FROM "wallets" w
        INNER JOIN "withdrawals" wd ON wd."userId" = w."userId"
        INNER JOIN "transactions" t ON t."withdrawalId" = wd."id"
        WHERE w."userId" = $1 AND wd."id" = $2
      `, [userId, result.withdrawalId]);
      expect(state.rows).toEqual([{
        winningBalance: "50.00",
        amount: "50.00",
        payoutMethod: "upi",
        payoutDetails: "wallet-router@upi",
        status: "pending",
        transactionAmount: "-50.00",
        balanceType: "winning",
      }]);

      const otherUser = await client.query<{ id: string }>(`INSERT INTO "users" ("openId", name, role) VALUES ($1, 'Other Withdrawal Player', 'user') RETURNING id`, [`wallet-router-other-${userId}`]);
      await client.query(`INSERT INTO "withdrawals" ("userId", "amount", "payoutMethod", "payoutDetails", status) VALUES ($1, 50, 'google_play', 'other@example.com', 'approved')`, [Number(otherUser.rows[0]!.id)]);
      const history = await caller.wallet.getWithdrawalHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ id: result.withdrawalId, amount: "50.00", payoutMethod: "upi", status: "pending" });

      await expect(caller.wallet.withdraw({
        amount: "20",
        payoutMethod: "upi",
        payoutDetails: "wallet-router@upi",
      })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Minimum withdrawal is 50 Coins" });

      await expect(caller.wallet.withdraw({
        amount: "60",
        payoutMethod: "upi",
        payoutDetails: "wallet-router@upi",
      })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Insufficient winning balance" });
    });
  }, 20_000);
});
