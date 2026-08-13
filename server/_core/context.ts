import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import type { WorkflowDatabase } from "../db";
import { sdk } from "./sdk";
import { ADMIN_SESSION_COOKIE_NAME } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  adminPanelAuthorized: boolean;
  /** Optional caller-only database transaction used by rollback-safe integration tests. */
  databaseOverride?: WorkflowDatabase;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const isAdminRequest = opts.req.header("x-admin-session") === "true";
  let adminPanelAuthorized = false;

  try {
    user = await sdk.authenticateRequest(opts.req, isAdminRequest ? ADMIN_SESSION_COOKIE_NAME : undefined);
    if (isAdminRequest && user) {
      adminPanelAuthorized = await sdk.hasAdminPanelAccess(opts.req, user.openId);
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    adminPanelAuthorized,
  };
}
