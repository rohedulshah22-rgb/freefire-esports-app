import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Deposit gateway-pending safeguards", () => {
  it("keeps the Razorpay release foundation inactive until merchant credentials are configured", async () => {
    const source = await readFile(resolve(process.cwd(), "client/src/pages/AddMoney.tsx"), "utf8");

    expect(source).toContain("PAYMENT GATEWAY · SETUP PENDING");
    expect(source).toContain("No payment is accepted yet");
    expect(source).toContain("Razorpay order creation");
  });

  it("keeps manual UTR collection out of the pending payment gateway page", async () => {
    const source = await readFile(resolve(process.cwd(), "client/src/pages/AddMoney.tsx"), "utf8");

    expect(source).not.toContain("UTR");
    expect(source).not.toContain("wallet.addMoney");
  });
});
