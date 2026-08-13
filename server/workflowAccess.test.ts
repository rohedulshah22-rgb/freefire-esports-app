import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(user: TrpcContext["user"], adminPanelAuthorized = false): TrpcContext {
  return {
    user,
    adminPanelAuthorized,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined, cookie: () => undefined } as TrpcContext["res"],
  };
}

const player = {
  id: 101,
  openId: "workflow-player",
  email: "player@example.com",
  name: "Workflow Player",
  loginMethod: "manus",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const administrator = { ...player, id: 102, openId: "workflow-admin", email: "rosidulshah4@gmail.com", role: "admin" as const };
const nonOwnerAdministrator = { ...player, id: 103, openId: "other-admin", email: "other-admin@example.com", role: "admin" as const };

describe("tournament workflow access", () => {
  it("requires the configured owner identity and a verified Admin Panel session", async () => {
    const adminCaller = appRouter.createCaller(createContext(administrator, true));
    await expect(adminCaller.admin.authorize()).resolves.toEqual({ authorized: true });

    const ownerWithoutCredentialGate = appRouter.createCaller(createContext(administrator));
    await expect(ownerWithoutCredentialGate.admin.authorize()).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const otherAdminCaller = appRouter.createCaller(createContext(nonOwnerAdministrator, true));
    await expect(otherAdminCaller.admin.authorize()).rejects.toMatchObject({ code: "FORBIDDEN" });

    const playerCaller = appRouter.createCaller(createContext(player));
    await expect(playerCaller.admin.authorize()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(playerCaller.withdrawals.getPending()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects room credential retrieval before an authenticated joined-player check can run", async () => {
    const anonymousCaller = appRouter.createCaller(createContext(null));
    await expect(anonymousCaller.matches.getRoomCredentials({ matchId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
