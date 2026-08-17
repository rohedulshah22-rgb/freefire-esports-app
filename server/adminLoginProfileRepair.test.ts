import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Admin login and Profile responsiveness repair", () => {
  it("keeps Admin credential verification owner-gated while allowing the supported username aliases", async () => {
    const routerSource = await readFile(new URL("./routers.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("verifyCredentials: ownerAdminProcedure");
    expect(routerSource).toContain("isSupportedAdminUsername(input.username)");
    expect(routerSource).toContain("verifyAdminPassword(input.password, credential.adminPasswordHash)");
  });

  it("renders an accessible Show/Hide password toggle and wraps Profile email identities", async () => {
    const [dashboardSource, profileSource] = await Promise.all([
      readFile(new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/Profile.tsx", import.meta.url), "utf8"),
    ]);
    expect(dashboardSource).toContain('type={passwordVisible ? "text" : "password"}');
    expect(dashboardSource).toContain('aria-label={passwordVisible ? "Hide administrator password" : "Show administrator password"}');
    expect(dashboardSource).toContain('aria-pressed={passwordVisible}');
    expect(profileSource).toContain('className="min-w-0 flex-1"');
    expect(profileSource).toContain('className="min-w-0 break-all"');
    expect(profileSource).toContain('className="mt-0.5 h-4 w-4 shrink-0"');
  });
});
