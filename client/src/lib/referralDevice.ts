const REFERRAL_DEVICE_TOKEN_KEY = "pro-esports-referral-device-token";

export function getReferralDeviceToken() {
  if (typeof window === "undefined") return undefined;
  const existing = window.localStorage.getItem(REFERRAL_DEVICE_TOKEN_KEY);
  if (existing) return existing;
  const token = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(REFERRAL_DEVICE_TOKEN_KEY, token);
  return token;
}
