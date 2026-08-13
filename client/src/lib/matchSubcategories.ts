export const MATCH_SUBCATEGORY_FILTERS = {
  BR: ["Full Map", "Booyah Only", "Survival", "Per Kill Special"],
  CS: ["CS Unlimited", "CS Limited", "Only Headshot", "Only UMP"],
  "Lone Wolf": ["1v1 Sniper", "2v2 Classic", "LW Headshot"],
} as const;

export type MatchCategoryWithSubcategories = keyof typeof MATCH_SUBCATEGORY_FILTERS;

function normalizeTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^(br|cs|lw|lone wolf)[\s:|\-]+/, "")
    .replace(/\s+/g, " ");
}

function normalizeTagTokens(value: string) {
  return normalizeTag(value).split(" ").sort().join(" ");
}

export function getMatchSubcategoryFilters(categoryName?: string) {
  if (!categoryName || !(categoryName in MATCH_SUBCATEGORY_FILTERS)) return [];
  return MATCH_SUBCATEGORY_FILTERS[categoryName as MatchCategoryWithSubcategories];
}

/**
 * Supports the Admin's readable prefixed tags (for example, "BR Per Kill Special")
 * and the exact player-facing tab label ("Per Kill Special").
 */
export function matchesSelectedSubcategory(customModeTag: string | null | undefined, subcategory: string | undefined) {
  if (!subcategory) return true;
  if (!customModeTag) return false;
  return normalizeTagTokens(customModeTag) === normalizeTagTokens(subcategory);
}
