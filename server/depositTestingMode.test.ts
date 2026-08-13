import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Deposit testing-mode safeguards", () => {
  it("keeps the Razorpay release foundation inactive until merchant credentials are configured", async () => {
    const source = await readFile(resolve(process.cwd(), "client/src/pages/AddMoney.tsx"), "utf8");

    expect(source).toContain("TESTING MODE · RAZORPAY READY");
    expect(source).toContain("Do not transfer real money");
    expect(source).toContain("Submit Test Deposit Request");
  });

  it("keeps the player UTR field aligned with the server's exact twelve-digit contract", async () => {
    const source = await readFile(resolve(process.cwd(), "client/src/pages/AddMoney.tsx"), "utf8");

    expect(source).toContain("maxLength={12}");
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('pattern="[0-9]{12}"');
    expect(source).toContain('replace(/\\D/g, "").slice(0, 12)');
    expect(source).toContain("/^\\d{12}$/.test(utrNumber)");
  });
});
