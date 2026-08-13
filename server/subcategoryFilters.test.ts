import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getMatchSubcategoryFilters, matchesSelectedSubcategory } from "../client/src/lib/matchSubcategories";

describe("player match sub-category filters", () => {
  it("provides the exact requested sub-category tabs for each match category", () => {
    expect(getMatchSubcategoryFilters("BR")).toEqual(["Full Map", "Booyah Only", "Survival", "Per Kill Special"]);
    expect(getMatchSubcategoryFilters("CS")).toEqual(["CS Unlimited", "CS Limited", "Only Headshot", "Only UMP"]);
    expect(getMatchSubcategoryFilters("Lone Wolf")).toEqual(["1v1 Sniper", "2v2 Classic", "LW Headshot"]);
    expect(getMatchSubcategoryFilters("Unknown")).toEqual([]);
  });

  it("matches Admin-created readable tag variations without returning untagged or mismatched matches", () => {
    expect(matchesSelectedSubcategory("BR Per Kill Special", "Per Kill Special")).toBe(true);
    expect(matchesSelectedSubcategory("CS Headshot Only", "Only Headshot")).toBe(true);
    expect(matchesSelectedSubcategory("Lone Wolf Sniper 1v1", "1v1 Sniper")).toBe(true);
    expect(matchesSelectedSubcategory("CS Only UMP", "CS Limited")).toBe(false);
    expect(matchesSelectedSubcategory(null, "Full Map")).toBe(false);
    expect(matchesSelectedSubcategory(null, undefined)).toBe(true);
  });

  it("renders an accessible tab group and filters the current upcoming-match result set", async () => {
    const homeSource = await readFile(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    expect(homeSource).toContain('Game Sub-Category');
    expect(homeSource).toContain('Choose a special game rule');
    expect(homeSource).toContain('aria-pressed={isSelected}');
    expect(homeSource).toContain('filteredUpcomingMatches');
    expect(homeSource).toContain('matchesSelectedSubcategory(match.match.customModeTag, selectedSubcategory)');
  });
});
