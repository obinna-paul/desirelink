import { prisma } from "@/lib/prisma";
import { deleteVerificationMedia } from "@/lib/verification";

export type DeleteOwnAccountResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Self-service account deletion (Settings > Security), distinct from
 * lib/admin/accounts.ts's deleteAccountCompletely: no admin capability, no admin-audit-log
 * check, and no "can't delete your own account" guard - deleting your own account is
 * exactly the point here. An admin account is still refused, the same as the admin flow
 * refuses to ever leave zero admins reachable - they must hand off admin duties first
 * (through the admin console, not this form).
 */
export async function deleteOwnAccount(userId: string): Promise<DeleteOwnAccountResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, profile: { select: { id: true } } },
  });
  if (!user) {
    return { ok: false, status: 404, error: "Account not found" };
  }
  if (user.isAdmin) {
    return {
      ok: false,
      status: 400,
      error: "Admin accounts can't be deleted from here - hand off admin access first.",
    };
  }

  if (user.profile) {
    const unpurgedVerifications = await prisma.verificationRequest.findMany({
      where: { profileId: user.profile.id, mediaDeletedAt: null },
      select: { id: true, govIdUrl: true, selfieUrl: true },
    });
    for (const request of unpurgedVerifications) {
      await deleteVerificationMedia(request);
    }
  }

  try {
    if (user.profile) {
      await prisma.report.updateMany({ where: { reportedUserId: user.profile.id }, data: { reportedUserId: null } });
    }
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    console.error("[account] self-service deletion failed", error);
    return {
      ok: false,
      status: 409,
      error: "Couldn't delete this account - it may still have live-request or gift history blocking the delete.",
    };
  }

  return { ok: true };
}
