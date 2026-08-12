import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const player = {
  id: 901,
  openId: "profile-test-user",
  email: "profile-test@example.com",
  name: "Profile Test Player",
  loginMethod: "manus",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function context(user: TrpcContext["user"]): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("player profile router", () => {
  it("requires an authenticated player to read a profile", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.profile.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects invalid Free Fire UID updates before attempting a database write", async () => {
    const caller = appRouter.createCaller(context(player));
    await expect(caller.profile.update({ freeFireName: "Profile Test", freeFireUid: "UID-INVALID" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
