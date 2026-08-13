import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("OAuth identity refresh preservation", () => {
  it("does not erase a verified account email when a refresh response omits it", async () => {
    const source = await readFile(resolve(process.cwd(), "server/db.ts"), "utf8");

    expect(source).toContain("email: user.email ?? sql`${users.email}`");
    expect(source).toContain("name: user.name ?? sql`${users.name}`");
    expect(source).toContain("loginMethod: user.loginMethod ?? sql`${users.loginMethod}`");
  });
});
