import { describe, expect, it } from "vitest";
import { allocateEntryFee } from "./tournamentWalletRules";

describe("allocateEntryFee", () => {
  it("deducts Deposit balance before Bonus balance", () => {
    expect(allocateEntryFee(100, 70, 50)).toEqual({ deductedFromDeposit: 70, deductedFromBonus: 30 });
    expect(allocateEntryFee(100, 150, 0)).toEqual({ deductedFromDeposit: 100, deductedFromBonus: 0 });
  });

  it("rejects a join when Deposit and Bonus balances cannot cover the fee", () => {
    expect(() => allocateEntryFee(100, 40, 50)).toThrow("Insufficient Deposit and Bonus balance");
  });
});
