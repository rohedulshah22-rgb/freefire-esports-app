export const ADMIN_OWNER_EMAIL = "rosidulshah4@gmail.com";
export const ADMIN_PANEL_LOGIN_PATH = "/admin-panel-secret-access";

export function canOpenAdminPanel(email: string | null | undefined) {
  return email?.trim().toLowerCase() === ADMIN_OWNER_EMAIL;
}
