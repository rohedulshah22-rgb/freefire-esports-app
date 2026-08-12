export type PlayerIdentity = {
  name?: string | null;
  email?: string | null;
};

export function getWelcomeIdentity(user: PlayerIdentity | null | undefined): string {
  return user?.name?.trim() || user?.email?.trim() || "";
}
