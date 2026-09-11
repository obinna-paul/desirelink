import type { ProfileType } from "@prisma/client";

/**
 * The CSS class that gives each account type its own accent color app-wide (see
 * app/globals.css). Creator keeps the default purple/clay root palette (empty class);
 * Explorer and Seeker each get their own accent so the app visibly reflects the
 * viewer's own account type, regardless of whose profile they're looking at.
 */
export function getAccountThemeClass(profileType: ProfileType): string {
  if (profileType === "CREATOR") return "";
  if (profileType === "SEEKER") return "theme-seeker";
  return "theme-olive";
}
