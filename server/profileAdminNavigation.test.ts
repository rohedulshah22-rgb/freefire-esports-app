import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_PANEL_LOGIN_PATH, canOpenAdminPanel } from "../client/src/lib/adminNavigation";

describe("owner-only Profile Admin navigation", () => {
  it("shows the Admin Panel destination only to the designated owner email", () => {
    expect(canOpenAdminPanel("rosidulshah4@gmail.com")).toBe(true);
    expect(canOpenAdminPanel("RosidulShah4@GMAIL.COM")).toBe(true);
    expect(canOpenAdminPanel("other-player@example.com")).toBe(false);
    expect(canOpenAdminPanel(null)).toBe(false);
  });

  it("uses the isolated Admin login route rather than a player OAuth URL", () => {
    expect(ADMIN_PANEL_LOGIN_PATH).toBe("/admin-panel-secret-access");
  });

  it("renders the Profile Admin Panel button only through the owner-email condition", async () => {
    const source = await readFile(resolve(process.cwd(), "client/src/pages/Profile.tsx"), "utf8");

    expect(source).toContain("{canAccessAdminPanel && (");
    expect(source).toContain("const openAdminPanel = () => setLocation(ADMIN_PANEL_LOGIN_PATH);");
    expect(source).toContain("onClick={openAdminPanel}");
    expect(source).toContain('aria-label="Open Admin Panel"');
    expect(source).toContain("cursor-pointer select-none");
  });
});
