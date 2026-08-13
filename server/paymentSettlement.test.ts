import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";
import { createPaymentAttempt, markPaymentAttemptFailed, settleVerifiedPaymentAttempt } from "./db";

describe("Razorpay-ready payment settlement", () => {
  it("credits Deposit Balance once for a verified payment and safely ignores provider redelivery", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    expect(connectionString, "NEON_DATABASE_URL must be configured").toMatch(/^postgres(?:ql)?:\/\//);

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    let transactionStarted = false;
    try {
      await client.connect();
      await client.query("BEGIN");
      transactionStarted = true;
      const user = await client.query<{ id: string }>(
        `INSERT INTO "users" ("openId", "name", "role") VALUES ($1, 'Payment Settlement Test', 'user') RETURNING "id"`,
        [`payment-settlement-${suffix}`],
      );
      const userId = Number(user.rows[0]!.id);
      await client.query(`INSERT INTO "wallets" ("userId", "depositBalance", "winningBalance", "bonusBalance") VALUES ($1, 10, 0, 0)`, [userId]);
      const db = drizzle(client, { schema });
      const orderId = `order_${suffix}`;
      const attemptId = await createPaymentAttempt({
        userId,
        amount: "50.00",
        provider: "razorpay",
        providerOrderId: orderId,
        idempotencyKey: `key_${suffix}`,
        status: "created",
      }, db);

      await expect(settleVerifiedPaymentAttempt({
        providerOrderId: orderId,
        providerPaymentId: `pay_${suffix}`,
        providerEventId: `event_${suffix}`,
      }, db)).resolves.toEqual({ paymentAttemptId: attemptId, credited: true, status: "captured" });
      await expect(settleVerifiedPaymentAttempt({
        providerOrderId: orderId,
        providerPaymentId: `pay_${suffix}`,
        providerEventId: `event_redelivery_${suffix}`,
      }, db)).resolves.toEqual({ paymentAttemptId: attemptId, credited: false, status: "captured" });

      const summary = await client.query<{ depositBalance: string; status: string; transactions: string }>(`
        SELECT w."depositBalance", pa."status",
          (SELECT COUNT(*) FROM "transactions" WHERE "paymentAttemptId" = pa."id") AS transactions
        FROM "wallets" w INNER JOIN "paymentAttempts" pa ON pa."userId" = w."userId"
        WHERE pa."id" = $1
      `, [attemptId]);
      expect(summary.rows).toEqual([{ depositBalance: "60.00", status: "captured", transactions: "1" }]);
    } finally {
      if (transactionStarted) await client.query("ROLLBACK").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  }, 20_000);

  it("prevents failed payment attempts from crediting a wallet", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    expect(connectionString, "NEON_DATABASE_URL must be configured").toMatch(/^postgres(?:ql)?:\/\//);

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    let transactionStarted = false;
    try {
      await client.connect();
      await client.query("BEGIN");
      transactionStarted = true;
      const user = await client.query<{ id: string }>(
        `INSERT INTO "users" ("openId", "name", "role") VALUES ($1, 'Failed Payment Test', 'user') RETURNING "id"`,
        [`failed-payment-${suffix}`],
      );
      const userId = Number(user.rows[0]!.id);
      const db = drizzle(client, { schema });
      const orderId = `order_failed_${suffix}`;
      await createPaymentAttempt({
        userId,
        amount: "50.00",
        provider: "razorpay",
        providerOrderId: orderId,
        idempotencyKey: `failed_key_${suffix}`,
        status: "created",
      }, db);
      await markPaymentAttemptFailed(orderId, "Payment declined", db);

      await expect(settleVerifiedPaymentAttempt({
        providerOrderId: orderId,
        providerPaymentId: `pay_failed_${suffix}`,
      }, db)).rejects.toThrow("Payment attempt cannot be settled after failure or cancellation");
    } finally {
      if (transactionStarted) await client.query("ROLLBACK").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  }, 20_000);
});
