import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagesDirectory = resolve(process.cwd(), "client/src/pages");

async function readWalletPage(fileName: string) {
  return readFile(resolve(pagesDirectory, fileName), "utf8");
}

describe("Wallet page dashboard return controls", () => {
  it("renders and wires the Deposit page Dashboard button to the Player App route", async () => {
    const source = await readWalletPage("AddMoney.tsx");

    expect(source).toContain('getPlayerDashboardPath');
    expect(source).toContain('onClick={() => setLocation(getPlayerDashboardPath())}');
    expect(source).toContain('Dashboard');
  });

  it("renders and wires the Withdrawal page Dashboard button to the Player App route", async () => {
    const source = await readWalletPage("Withdrawal.tsx");

    expect(source).toContain('getPlayerDashboardPath');
    expect(source).toContain('onClick={() => setLocation(getPlayerDashboardPath())}');
    expect(source).toContain('Dashboard');
  });
});
