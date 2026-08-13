import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Admin Dashboard return navigation", () => {
  it("keeps a prominent Player App return action that uses same-tab routing", async () => {
    const source = await readFile(resolve(process.cwd(), "client/src/pages/AdminDashboard.tsx"), "utf8");
    expect(source).toContain("Return to Player App");
    expect(source).toContain('onClick={() => setLocation("/")}');
    expect(source).toContain("Gamepad2");
  });
});
