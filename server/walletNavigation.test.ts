import { describe, expect, it } from "vitest";
import { getWalletActionPath } from "../client/src/lib/walletNavigation";

describe("Home wallet navigation", () => {
  it("routes each wallet action to its existing Neon-backed player form", () => {
    expect(getWalletActionPath("add-money")).toBe("/add-money");
    expect(getWalletActionPath("withdraw")).toBe("/withdraw");
  });
});
