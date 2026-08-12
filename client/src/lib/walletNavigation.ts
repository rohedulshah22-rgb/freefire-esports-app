export type WalletAction = "add-money" | "withdraw";

export function getWalletActionPath(action: WalletAction): string {
  return action === "add-money" ? "/add-money" : "/withdraw";
}

export function getPlayerDashboardPath(): string {
  return "/";
}
