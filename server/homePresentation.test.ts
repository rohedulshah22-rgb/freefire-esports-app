import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWelcomeIdentity } from "../client/src/lib/playerPresentation";

describe("Home welcome identity", () => {
  it("prefers a signed-in player name and safely falls back to email", () => {
    expect(getWelcomeIdentity({ name: "Rosidul Shah", email: "rosidulshah4@gmail.com" })).toBe("Rosidul Shah");
    expect(getWelcomeIdentity({ name: " ", email: "rosidulshah4@gmail.com" })).toBe("rosidulshah4@gmail.com");
    expect(getWelcomeIdentity({ name: "Another Player", email: "another@example.com" })).toBe("Another Player");
    expect(getWelcomeIdentity({ name: null, email: "another@example.com" })).toBe("another@example.com");
    expect(getWelcomeIdentity(null)).toBe("");
  });

  it("prioritizes match selection, then wallet actions, with a compact wallet UTR reminder and referral banner last", async () => {
    const homeSource = await readFile(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    const matchSection = homeSource.indexOf('aria-labelledby="match-categories-heading"');
    const walletSection = homeSource.indexOf("<h2 className=\"text-lg font-bold\">Wallet Balance</h2>");
    const referralSection = homeSource.lastIndexOf("<h2 className=\"text-lg font-black text-accent\">Refer & Earn</h2>");

    expect(matchSection).toBeGreaterThan(-1);
    expect(walletSection).toBeGreaterThan(matchSection);
    expect(referralSection).toBeGreaterThan(walletSection);
    expect(homeSource).toContain("function WalletUTRReminder()");
    expect(homeSource).toContain("<WalletUTRReminder />");
    expect(homeSource).not.toContain("<UTRWarning />");
  });
});
