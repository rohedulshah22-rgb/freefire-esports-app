import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("player profile UI intent", () => {
  it("exposes Home-to-Profile navigation and safe account actions", async () => {
    const [home, profile] = await Promise.all([
      readFile(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/Profile.tsx", import.meta.url), "utf8"),
    ]);

    expect(home).toContain('window.location.href = "/profile"');
    expect(profile).toContain("await logout()");
    expect(profile).toContain("getLoginUrl({ switchAccount: true })");
    expect(profile).toContain("Switch Account");
    expect(profile).toContain("Logout");
  });
});
