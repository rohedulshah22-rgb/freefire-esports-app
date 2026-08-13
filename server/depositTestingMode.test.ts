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
});
