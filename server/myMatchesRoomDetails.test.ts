import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const router = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const db = readFileSync(resolve(root, "server/db.ts"), "utf8");
const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const dialog = readFileSync(resolve(root, "client/src/components/MatchStatusDialog.tsx"), "utf8");
const myMatches = readFileSync(resolve(root, "client/src/pages/MyMatches.tsx"), "utf8");

describe("Player My Matches and protected room details", () => {
  it("uses a protected user-scoped match aggregation while retaining existing joined-player credential controls", () => {
    expect(router).toContain("getMyMatches: protectedProcedure");
    expect(db).toContain("getMyRegisteredMatches(userId: number)");
    expect(db).toContain("eq(matchParticipants.userId, userId)");
    expect(router).toContain("getRoomCredentialsForJoinedPlayer(input.matchId, ctx.user.id)");
  });

  it("provides joined-card access, a copyable room dialog, and live My Matches countdowns", () => {
    expect(home).toContain("onJoinedClick");
    expect(home).toContain("MatchStatusDialog");
    expect(home).toContain('window.location.href = "/my-matches"');
    expect(dialog).toContain("navigator.clipboard.writeText");
    expect(dialog).toContain("Room Password");
    expect(myMatches).toContain("Starts in {countdown(match.scheduledStartTime)}");
  });
});
