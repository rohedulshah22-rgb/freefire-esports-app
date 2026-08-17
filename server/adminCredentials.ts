import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const ADMIN_USERNAME_ALIASES = ["admin", "r-esports"] as const;

export function isSupportedAdminUsername(username: string) {
  return ADMIN_USERNAME_ALIASES.includes(username.trim().toLowerCase() as (typeof ADMIN_USERNAME_ALIASES)[number]);
}

export function createAdminPasswordHash(password: string) {
  const salt = randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("base64")}`;
}

export function verifyAdminPassword(password: string, storedHash: string) {
  const [algorithm, salt, encodedHash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedHash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(encodedHash, "base64");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
