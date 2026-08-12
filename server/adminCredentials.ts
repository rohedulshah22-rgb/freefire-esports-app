import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
