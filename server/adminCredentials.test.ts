import { describe, expect, it } from "vitest";
import { createAdminPasswordHash, verifyAdminPassword } from "./adminCredentials";

describe("administrator credential hashing", () => {
  it("validates only the password used to create the scrypt hash", () => {
    const hash = createAdminPasswordHash("$ROSIDUL₹");
    expect(verifyAdminPassword("$ROSIDUL₹", hash)).toBe(true);
    expect(verifyAdminPassword("incorrect-password", hash)).toBe(false);
    expect(verifyAdminPassword("$ROSIDUL₹", "invalid")).toBe(false);
  });
});
