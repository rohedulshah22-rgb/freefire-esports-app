import { afterEach, describe, expect, it, vi } from "vitest";
import { getLoginUrl } from "../client/src/const";

describe("getLoginUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("adds the OAuth account-selector prompt when switching accounts", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://auth.example.com");
    vi.stubEnv("VITE_APP_ID", "profile-test-app");
    vi.stubGlobal("window", { location: { origin: "https://player.example.com" } });

    const url = new URL(getLoginUrl({ switchAccount: true }));
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("type")).toBe("signIn");
  });
});
