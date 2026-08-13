import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("BooyahCraft managed brand configuration", () => {
  it("exposes the official project title and BooyahCraft logo asset", () => {
    expect(process.env.VITE_APP_TITLE).toBe("BooyahCraft");
    expect(process.env.VITE_APP_LOGO).toBe("/manus-storage/booyahcraft-logo_c5e2c04c.png");
  });

  it("uses the official name, tagline, logo, and sharing title across player and social surfaces", async () => {
    const [indexSource, homeSource, profileSource, deviceGuardSource] = await Promise.all([
      readFile(new URL("../client/index.html", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/Profile.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/components/DeviceRestrictionGuard.tsx", import.meta.url), "utf8"),
    ]);
    const socialTitle = "BooyahCraft - Ultimate Free Fire & Esports Tournament Platform";
    expect(indexSource).toContain(`<title>${socialTitle.replace("&", "&amp;")}</title>`);
    expect(indexSource).toContain('property="og:title" content="BooyahCraft - Ultimate Free Fire &amp; Esports Tournament Platform"');
    expect(indexSource).toContain('property="og:image" content="https://freefireesports-x23zgzvt.manus.space/manus-storage/booyahcraft-logo_c5e2c04c.png"');
    expect(indexSource).toContain('name="twitter:image" content="https://freefireesports-x23zgzvt.manus.space/manus-storage/booyahcraft-logo_c5e2c04c.png"');
    expect(homeSource).toContain("BRAND_LOGO_URL");
    expect(homeSource).toContain("BRAND_TAGLINE");
    expect(profileSource).toContain("title: BRAND_SOCIAL_TITLE");
    expect(deviceGuardSource).toContain("access {BRAND_NAME}");
  });
});
