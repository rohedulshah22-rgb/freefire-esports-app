import { describe, expect, it } from "vitest";
import { sdk } from "./_core/sdk";

describe("OAuth session identity", () => {
  it("keeps an email-only OAuth session valid when no display name is supplied", async () => {
    const token = await sdk.createSessionToken("email-only-player", { name: "", expiresInMs: 60_000 });
    await expect(sdk.verifySession(token)).resolves.toMatchObject({
      openId: "email-only-player",
      name: "",
    });
  });
});
