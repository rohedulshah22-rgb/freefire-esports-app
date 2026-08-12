import { afterEach, describe, expect, it, vi } from "vitest";
import { isDeviceAllowed } from "../client/src/lib/deviceDetection";

function stubBrowser(userAgent: string) {
  vi.stubGlobal("navigator", { userAgent });
  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => null }),
  });
}

describe("Android-only device restriction", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("blocks desktop browser user agents", () => {
    stubBrowser("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0");
    expect(isDeviceAllowed()).toBe(false);
  });

  it("permits a real Android mobile user agent", () => {
    stubBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36");
    expect(isDeviceAllowed()).toBe(true);
  });
});
