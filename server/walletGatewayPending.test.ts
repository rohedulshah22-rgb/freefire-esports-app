import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Wallet cleanup and Razorpay gateway readiness", () => {
  it("removes all UTR presentation from the Wallet interface", async () => {
    const source = await readFile(resolve(process.cwd(), "client/src/pages/Wallet.tsx"), "utf8");
    expect(source).not.toContain("UTR");
    expect(source).toContain('window.location.href = "/add-money"');
  });

  it("keeps Add Money in a safe setup-pending state while preserving server-only Razorpay configuration", async () => {
    const [addMoney, razorpay, env] = await Promise.all([
      readFile(resolve(process.cwd(), "client/src/pages/AddMoney.tsx"), "utf8"),
      readFile(resolve(process.cwd(), "server/razorpay.ts"), "utf8"),
      readFile(resolve(process.cwd(), "server/_core/env.ts"), "utf8"),
    ]);
    expect(addMoney).toContain("PAYMENT GATEWAY · SETUP PENDING");
    expect(addMoney).not.toContain("UTR");
    expect(razorpay).toContain("getRazorpayReadiness");
    expect(env).toContain("RAZORPAY_KEY_ID");
    expect(env).toContain("RAZORPAY_KEY_SECRET");
  });
});
