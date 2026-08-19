import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const dialog = readFileSync(resolve(root, "client/src/components/PlayerJoinForm.tsx"), "utf8");
const router = readFileSync(resolve(root, "server/routers.ts"), "utf8");

describe("Join flow reliability repair", () => {
  it("locks joined cards and invalidates the joined match cache after a successful join", () => {
    expect(home).toContain('disabled={isJoined}');
    expect(home).toContain('isJoined ? "Joined" : "Join"');
    expect(home).toContain("utils.matches.getJoinedMatchIds.invalidate()");
  });

  it("keeps the join dialog scrollable and enforces saved-profile compatible identity rules", () => {
    expect(dialog).toContain("overflow-y-auto overscroll-contain");
    expect(dialog).toContain("max-h-[min(86dvh,44rem)]");
    expect(dialog).toContain("/^\\d{8,12}$/");
    expect(dialog).toContain("initialIgn");
    expect(dialog).toContain("initialUid");
    expect(router).toContain("Free Fire UID must be 8 to 12 digits");
  });
});
