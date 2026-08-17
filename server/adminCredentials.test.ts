import { describe, expect, it } from "vitest";
import { createAdminPasswordHash, isSupportedAdminUsername, verifyAdminPassword } from "./adminCredentials";

describe("administrator credential hashing", () => {
  it("validates only the password used to create the scrypt hash", () => {
    const hash = createAdminPasswordHash("$ROSIDUL₹");
    expect(verifyAdminPassword("$ROSIDUL₹", hash)).toBe(true);
    expect(verifyAdminPassword("incorrect-password", hash)).toBe(false);
    expect(verifyAdminPassword("$ROSIDUL₹", "invalid")).toBe(false);
  });

  it("accepts both requested Administrator username aliases without accepting lookalikes", () => {
    expect(isSupportedAdminUsername("admin")).toBe(true);
    expect(isSupportedAdminUsername("ADMIN")).toBe(true);
    expect(isSupportedAdminUsername(" R-ESPORTS ")).toBe(true);
    expect(isSupportedAdminUsername("r-esports")).toBe(true);
    expect(isSupportedAdminUsername("administrator")).toBe(false);
  });
});
