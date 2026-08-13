import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getAdminLoginUrl } from "../client/src/const";

describe("Admin owner session intent", () => {
  it("uses a dedicated callback and account-selection prompt for the Admin Panel", () => {
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      value: { location: { origin: "https://freefire.example" } },
      configurable: true,
    });
    try {
      const url = new URL(getAdminLoginUrl());
      expect(url.searchParams.get("redirectUri")).toBe("https://freefire.example/api/admin/oauth/callback");
      expect(url.searchParams.get("prompt")).toBe("select_account");
    } finally {
      Object.defineProperty(globalThis, "window", { value: previousWindow, configurable: true });
    }
  });

  it("marks Admin Panel tRPC calls for the separate admin-session cookie", async () => {
    const source = await readFile(resolve(process.cwd(), "client/src/main.tsx"), "utf8");
    expect(source).toContain('headers.set("x-admin-session", "true")');
    expect(source).toContain('window.location.pathname === "/admin-panel-secret-access" ? getAdminLoginUrl() : getLoginUrl()');
  });
});
