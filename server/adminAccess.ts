import type { User } from "../drizzle/schema";

export const ADMIN_OWNER_EMAIL = "rosidulshah4@gmail.com";

export function isOwnerAdminUser(user: User | null | undefined) {
  return user?.role === "admin" && user.email?.trim().toLowerCase() === ADMIN_OWNER_EMAIL;
}
