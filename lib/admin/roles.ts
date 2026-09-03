import "server-only";

import type { AdminRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAdminAction } from "@/lib/admin/audit";

export async function listAdmins() {
  return prisma.user.findMany({
    where: { isAdmin: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, adminRole: true, createdAt: true },
  });
}

export type RoleActionResult = { ok: true } | { ok: false; status: number; error: string };

export async function setAdminRole(targetUserId: string, actorId: string, role: AdminRole): Promise<RoleActionResult> {
  if (targetUserId === actorId) {
    return { ok: false, status: 403, error: "You can't change your own role." };
  }
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { email: true } });
  if (!target) {
    return { ok: false, status: 404, error: "User not found." };
  }

  await prisma.user.update({ where: { id: targetUserId }, data: { isAdmin: true, adminRole: role } });
  await recordAdminAction({
    actorId,
    action: "admin.role_change",
    targetType: "user",
    targetId: targetUserId,
    summary: `Set ${target.email}'s admin role to ${role}`,
  });

  return { ok: true };
}

export async function revokeAdmin(targetUserId: string, actorId: string): Promise<RoleActionResult> {
  if (targetUserId === actorId) {
    return { ok: false, status: 403, error: "You can't revoke your own admin access." };
  }
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { email: true, isAdmin: true } });
  if (!target) {
    return { ok: false, status: 404, error: "User not found." };
  }
  if (!target.isAdmin) {
    return { ok: false, status: 400, error: "This user isn't an admin." };
  }

  await prisma.user.update({ where: { id: targetUserId }, data: { isAdmin: false, adminRole: null } });
  await recordAdminAction({
    actorId,
    action: "admin.role_change",
    targetType: "user",
    targetId: targetUserId,
    summary: `Revoked admin access for ${target.email}`,
  });

  return { ok: true };
}

export async function grantAdmin(email: string, actorId: string, role: AdminRole): Promise<RoleActionResult & { userId?: string }> {
  const target = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true },
  });
  if (!target) {
    return { ok: false, status: 404, error: "No account exists with that email." };
  }

  await prisma.user.update({ where: { id: target.id }, data: { isAdmin: true, adminRole: role } });
  await recordAdminAction({
    actorId,
    action: "admin.role_change",
    targetType: "user",
    targetId: target.id,
    summary: `Granted ${role} admin access to ${target.email}`,
  });

  return { ok: true, userId: target.id };
}
