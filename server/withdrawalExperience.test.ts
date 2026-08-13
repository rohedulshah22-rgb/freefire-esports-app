import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Withdrawal player experience", () => {
  it("keeps the 50-Coin Winning Balance rule, processing promise, and status history visible", async () => {
    const source = await readFile(new URL("../client/src/pages/Withdrawal.tsx", import.meta.url), "utf8");
    expect(source).toContain("const MINIMUM_WITHDRAWAL_COINS = 50");
    expect(source).toContain("Minimum Withdrawal Limit");
    expect(source).toContain("50 Coins / ₹50");
    expect(source).toContain("Winning Balance only");
    expect(source).toContain("Payouts are processed within 24 hours");
    expect(source).toContain("trpc.wallet.getWithdrawalHistory.useQuery");
    expect(source).toContain("Withdrawal History");
    expect(source).toContain("formatPayoutMethod(withdrawal.payoutMethod)");
    expect(source).toContain("withdrawalStatusStyle[withdrawal.status]");
  });

  it("uses a protected current-user history procedure rather than a caller-provided user ID", async () => {
    const routerSource = await readFile(new URL("./routers.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("getWithdrawalHistory: protectedProcedure");
    expect(routerSource).toContain("getUserWithdrawals(ctx.user.id, ctx.databaseOverride)");
    expect(routerSource).not.toContain("getUserWithdrawals(input.userId");
  });
});
