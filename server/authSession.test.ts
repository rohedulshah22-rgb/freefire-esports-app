import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("auth.me", () => {
  it("returns player identity but never exposes an administrator password hash", async () => {
    const user = {
      id: 51,
      openId: "session-test-user",
      name: "Session Player",
      email: "session@example.com",
      role: "admin" as const,
      adminPasswordHash: "scrypt$must-not-be-exposed",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>;
    const ctx: TrpcContext = { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };

    const result = await appRouter.createCaller(ctx).auth.me();
    expect(result).toMatchObject({ name: "Session Player", email: "session@example.com" });
    expect(result).not.toHaveProperty("adminPasswordHash");
  });
});
