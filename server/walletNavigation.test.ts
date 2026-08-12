import { describe, expect, it } from "vitest";
import { getPlayerDashboardPath, getWalletActionPath } from "../client/src/lib/walletNavigation";

describe("Home wallet navigation", () => {
  it("routes each wallet action to its existing Neon-backed player form", () => {
    expect(getWalletActionPath("add-money")).toBe("/add-money");
    expect(getWalletActionPath("withdraw")).toBe("/withdraw");
  });

  it("returns Wallet pages to the Player App dashboard", () => {
    expect(getPlayerDashboardPath()).toBe("/");
  });
});
