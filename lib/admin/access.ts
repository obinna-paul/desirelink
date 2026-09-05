import "server-only";

import type { AdminRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type { AdminRole };

export type AdminCapability =
  | "view_accounts"
  | "write_notes"
  | "moderate_content"
  | "view_locked_content"
  | "view_verification_media"
  | "manage_payouts"
  | "manage_roles"
  | "view_audit_log"
  | "manage_support_tickets";

const CAPABILITIES: Record<AdminRole, AdminCapability[]> = {
  SUPPORT: ["view_accounts", "write_notes", "manage_support_tickets"],
  MODERATOR: ["view_accounts", "write_notes", "moderate_content", "view_locked_content", "view_verification_media"],
  FINANCE: ["view_accounts", "write_notes", "manage_payouts"],
  SUPERADMIN: [
    "view_accounts",
    "write_notes",
    "moderate_content",
    "view_locked_content",
    "view_verification_media",
    "manage_payouts",
    "manage_roles",
    "view_audit_log",
    "manage_support_tickets",
  ],
};

export type AdminContext =
  | { isAdmin: false; role: null; capabilities: ReadonlySet<AdminCapability> }
  | { isAdmin: true; role: AdminRole; capabilities: ReadonlySet<AdminCapability> };

/**
 * Resolves what a user can do in the admin console. A `null` adminRole on an isAdmin user
 * is treated as SUPERADMIN - roles were added after the first admin accounts existed, and
 * an unset role should never silently remove access someone already had.
 */
export async function getAdminContext(userId: string): Promise<AdminContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, adminRole: true },
  });
  if (!user?.isAdmin) {
    return { isAdmin: false, role: null, capabilities: new Set() };
  }

  const role = user.adminRole ?? "SUPERADMIN";
  return { isAdmin: true, role, capabilities: new Set(CAPABILITIES[role]) };
}

export type RequireCapabilityResult =
  | { ok: true; role: AdminRole }
  | { ok: false; status: number; error: string };

/** Server-side capability gate - call this in every admin route handler and privileged
 * server component. Never trust that the UI hid the button; this is the real boundary. */
export async function requireCapability(
  userId: string | undefined,
  capability: AdminCapability
): Promise<RequireCapabilityResult> {
  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const context = await getAdminContext(userId);
  if (!context.isAdmin) {
    return { ok: false, status: 404, error: "Not found" };
  }
  if (!context.capabilities.has(capability)) {
    return { ok: false, status: 403, error: "Your admin role doesn't include this action" };
  }

  return { ok: true, role: context.role };
}
