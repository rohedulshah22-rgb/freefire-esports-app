import { ADMIN_PANEL_ACCESS_COOKIE_NAME, ADMIN_SESSION_COOKIE_NAME, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ADMIN_OWNER_EMAIL } from "../adminAccess";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  const handleCallback = async (
    req: Request,
    res: Response,
    options: { cookieName: string; redirectPath: string; requireOwnerEmail?: boolean },
  ) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      if (options.requireOwnerEmail && userInfo.email?.trim().toLowerCase() !== ADMIN_OWNER_EMAIL) {
        const cookieOptions = getSessionCookieOptions(req);
        res.clearCookie(ADMIN_SESSION_COOKIE_NAME, cookieOptions);
        res.clearCookie(ADMIN_PANEL_ACCESS_COOKIE_NAME, cookieOptions);
        res.redirect(302, `${options.redirectPath}?authError=owner-account-required`);
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(options.cookieName, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      if (options.requireOwnerEmail) {
        res.clearCookie(ADMIN_PANEL_ACCESS_COOKIE_NAME, cookieOptions);
      }

      res.redirect(302, options.redirectPath);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  };

  app.get("/api/oauth/callback", (req, res) => handleCallback(req, res, {
    cookieName: COOKIE_NAME,
    redirectPath: "/",
  }));
  app.get("/api/admin/oauth/callback", (req, res) => handleCallback(req, res, {
    cookieName: ADMIN_SESSION_COOKIE_NAME,
    redirectPath: "/admin-panel-secret-access",
    requireOwnerEmail: true,
  }));
}
