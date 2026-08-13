import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Leaderboard player and Admin interface intent", () => {
  it("registers a protected Player Leaderboard route and Home navigation path", async () => {
    const [app, home] = await Promise.all([
      readFile(resolve(process.cwd(), "client/src/App.tsx"), "utf8"),
      readFile(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8"),
    ]);
    expect(app).toContain('path={"/leaderboard"}');
    expect(home).toContain('window.location.href = "/leaderboard"');
  });

  it("includes podiums, both filter groups, player stats preview, and a persistent personal rank bar", async () => {
    const source = await readFile(resolve(process.cwd(), "client/src/pages/Leaderboard.tsx"), "utf8");
    expect(source).toContain("Top Podium");
    expect(source).toContain("Top Kills");
    expect(source).toContain("Top Earnings");
    expect(source).toContain("Matches Played");
    expect(source).toContain("Daily");
    expect(source).toContain("Weekly");
    expect(source).toContain("All-Time");
    expect(source).toContain("fixed bottom-0");
    expect(source).toContain("Competitive stat preview");
  });

  it("keeps reward configuration and manual weekly reset in the secured Admin Dashboard", async () => {
    const source = await readFile(resolve(process.cwd(), "client/src/pages/AdminDashboard.tsx"), "utf8");
    expect(source).toContain('TabsTrigger value="leaderboard"');
    expect(source).toContain("trpc.leaderboard.updateRewards.useMutation");
    expect(source).toContain("trpc.leaderboard.resetWeeklyCycle.useMutation");
    expect(source).toContain("Reset Weekly Cycle");
  });
});
