import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { getUserById, getWallet } from "./db";
import type { TrpcContext } from "./_core/context";

function context(user: NonNullable<TrpcContext["user"]>): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("wallet.getBalance", () => {
  it("returns the current Neon wallet record for an authenticated player without modifying data", async () => {
    const user = await getUserById(51);
    expect(user?.email).toBe("rosidulshah4@gmail.com");
    const expected = await getWallet(user!.id);
    const result = await appRouter.createCaller(context(user!)).wallet.getBalance();

    expect(result).toEqual(expected);
    expect(result?.bonusBalance).toBe("100.00");
  });
});
