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

  it("prioritizes match selection, then UTR-free wallet actions, with the referral banner last", async () => {
    const homeSource = await readFile(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    const matchSection = homeSource.indexOf('aria-labelledby="match-categories-heading"');
    const walletSection = homeSource.indexOf("<h2 className=\"text-lg font-bold\">Wallet Balance</h2>");
    const referralSection = homeSource.lastIndexOf("<h2 className=\"text-lg font-black text-accent\">Refer & Earn</h2>");

    expect(matchSection).toBeGreaterThan(-1);
    expect(walletSection).toBeGreaterThan(matchSection);
    expect(referralSection).toBeGreaterThan(walletSection);
    expect(homeSource).not.toContain("WalletUTRReminder");
    expect(homeSource).not.toContain("UTR Verification Required");
  });

  it("uses compact two-column Match Category cards while retaining category actions", async () => {
    const homeSource = await readFile(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    expect(homeSource).toContain('className="grid grid-cols-2 gap-3"');
    expect(homeSource).toContain("min-h-[138px] flex-col p-3");
    expect(homeSource).toContain("h-8 w-full border-primary/35");
    expect(homeSource).toContain("categories.length % 2 === 1 && index === categories.length - 1");
    expect(homeSource).toContain("col-span-2 mx-auto w-[calc(50%-0.375rem)]");
    expect(homeSource).toContain("onClick={() => onSelect(category.id)}");
    expect(homeSource).toContain("View Matches");
  });
});
