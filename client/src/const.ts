export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (options?: { switchAccount?: boolean; callbackPath?: string }) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}${options?.callbackPath ?? "/api/oauth/callback"}`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  if (options?.switchAccount) url.searchParams.set("prompt", "select_account");

  return url.toString();
};

export const getAdminLoginUrl = () => getLoginUrl({
  callbackPath: "/api/admin/oauth/callback",
  switchAccount: true,
});
