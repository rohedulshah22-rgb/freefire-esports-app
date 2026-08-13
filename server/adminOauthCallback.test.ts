import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Admin OAuth callback repair", () => {
  it("keeps the dedicated owner callback and returns owner callback failures to the Admin login page", async () => {
    const source = await readFile(resolve(process.cwd(), "server/_core/oauth.ts"), "utf8");

    expect(source).toContain('app.get("/api/admin/oauth/callback"');
    expect(source).toContain('redirectPath: "/admin-panel-secret-access"');
    expect(source).toContain('?authError=callback-failed');
  });

  it("detects an openId collision before attempting an email-account reassignment", async () => {
    const source = await readFile(resolve(process.cwd(), "server/db.ts"), "utf8");

    expect(source).toContain("const [existingByOpenId]");
    expect(source).toContain("existingByOpenId.id !== existingByEmail.id");
    expect(source).toContain("OAuth identity is already linked to a different account");
  });
});
