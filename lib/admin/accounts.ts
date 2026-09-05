import "server-only";

import { prisma } from "@/lib/prisma";
import { recordAdminAction } from "@/lib/admin/audit";
import { getActiveSubscriberCount } from "@/lib/creator";
import { sendAccountReinstatedEmail, sendAccountSuspendedEmail } from "@/lib/email/notifications";
import { deleteVerificationMedia } from "@/lib/verification";

const searchResultSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  profileType: true,
  isVerified: true,
  isVerifiedCreator: true,
  isSuspended: true,
  createdAt: true,
  user: { select: { email: true } },
} as const;

export type AccountSearchResult = Awaited<ReturnType<typeof searchAccounts>>[number];

/** Finds accounts by username, display name, or email - the support workhorse. Empty
 * query returns nothing rather than the whole user table. */
export async function searchAccounts(query: string, take = 20) {
  const q = query.trim();
  if (!q) return [];

  return prisma.profile.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    },
    take,
    orderBy: { createdAt: "desc" },
    select: searchResultSelect,
  });
}

/** The full 360-degree record behind an account: profile, content footprint, money,
 * reports, admin notes, and the admin actions taken directly against this profile. */
export async function getAccountDetail(username: string) {
  const profile = await prisma.profile.findUnique({
    where: { username },
    select: {
      id: true,
      userId: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      profileType: true,
      city: true,
      country: true,
      isVerified: true,
      isVerifiedCreator: true,
      isVerifiedServiceProvider: true,
      verificationPending: true,
      isTrustedMember: true,
      isSuspended: true,
      suspendedAt: true,
      warningCount: true,
      communityStanding: true,
      heartsBalance: true,
      walletBalanceCents: true,
      createdAt: true,
      user: { select: { email: true, isAdmin: true, adminRole: true } },
    },
  });
  if (!profile) return null;

  const [
    postCount,
    premiumPostCount,
    subscriberCount,
    serviceListingCount,
    reportsPendingAgainst,
    reportsMade,
    recentTransactions,
    pendingWithdrawals,
    paidWithdrawals,
    notes,
    adminHistory,
    posts,
    serviceListings,
  ] = await Promise.all([
    prisma.post.count({ where: { authorId: profile.id, isArchived: false } }),
    prisma.post.count({ where: { authorId: profile.id, isArchived: false, isSubscriberOnly: true } }),
    getActiveSubscriberCount(profile.id),
    prisma.serviceListing.count({ where: { providerId: profile.id } }),
    prisma.report.count({ where: { reportedUserId: profile.id, status: "pending" } }),
    prisma.report.count({ where: { reporterId: profile.id } }),
    prisma.transaction.findMany({ where: { userId: profile.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.walletWithdrawal.findMany({
      where: { providerId: profile.id, status: { in: ["pending", "processing"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.walletWithdrawal.aggregate({
      where: { providerId: profile.id, status: "paid" },
      _sum: { netAmountCents: true },
      _count: { _all: true },
    }),
    prisma.adminNote.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true, email: true } } },
    }),
    prisma.adminAuditLog.findMany({
      where: { targetType: "profile", targetId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true, email: true } } },
    }),
    // Deliberately no `content` field - the Content tab list must never leak a premium
    // post's caption/media outside the reason-gated viewer (see lib/admin/content.ts).
    prisma.post.findMany({
      where: { authorId: profile.id, isArchived: false },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, isSubscriberOnly: true, viewCount: true, createdAt: true, _count: { select: { reactions: true, comments: true } } },
    }),
    prisma.serviceListing.findMany({
      where: { providerId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, priceCents: true, createdAt: true },
    }),
  ]);

  return {
    profile,
    stats: {
      postCount,
      premiumPostCount,
      subscriberCount,
      serviceListingCount,
      reportsPendingAgainst,
      reportsMade,
      lifetimeWithdrawnCents: paidWithdrawals._sum.netAmountCents ?? 0,
      paidWithdrawalCount: paidWithdrawals._count._all,
    },
    recentTransactions,
    pendingWithdrawals,
    notes,
    adminHistory,
    posts,
    serviceListings,
  };
}

export type AccountDetail = NonNullable<Awaited<ReturnType<typeof getAccountDetail>>>;

export type AccountActionResult = { ok: true } | { ok: false; status: number; error: string };

export async function suspendAccount(profileId: string, actorId: string, reason: string): Promise<AccountActionResult> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { username: true, isSuspended: true } });
  if (!profile) {
    return { ok: false, status: 404, error: "Account not found" };
  }
  if (profile.isSuspended) {
    return { ok: false, status: 400, error: "This account is already suspended" };
  }

  await prisma.profile.update({ where: { id: profileId }, data: { isSuspended: true, suspendedAt: new Date() } });
  await recordAdminAction({
    actorId,
    action: "account.suspend",
    targetType: "profile",
    targetId: profileId,
    summary: reason ? `Suspended @${profile.username}: ${reason}` : `Suspended @${profile.username}`,
  });
  await sendAccountSuspendedEmail(profileId);

  return { ok: true };
}

export async function reinstateAccount(profileId: string, actorId: string): Promise<AccountActionResult> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { username: true, isSuspended: true } });
  if (!profile) {
    return { ok: false, status: 404, error: "Account not found" };
  }
  if (!profile.isSuspended) {
    return { ok: false, status: 400, error: "This account isn't suspended" };
  }

  await prisma.profile.update({ where: { id: profileId }, data: { isSuspended: false, suspendedAt: null } });
  await recordAdminAction({
    actorId,
    action: "account.reinstate",
    targetType: "profile",
    targetId: profileId,
    summary: `Reinstated @${profile.username}`,
  });
  await sendAccountReinstatedEmail(profileId);

  return { ok: true };
}

const MAX_NOTE_LENGTH = 2000;

export async function addAccountNote(
  profileId: string,
  authorId: string,
  body: string
): Promise<AccountActionResult & { noteId?: string }> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, status: 400, error: "Note can't be empty" };
  }
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return { ok: false, status: 400, error: `Note must be under ${MAX_NOTE_LENGTH} characters` };
  }

  const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { username: true } });
  if (!profile) {
    return { ok: false, status: 404, error: "Account not found" };
  }

  const note = await prisma.adminNote.create({ data: { profileId, authorId, body: trimmed } });
  await recordAdminAction({
    actorId: authorId,
    action: "account.note",
    targetType: "profile",
    targetId: profileId,
    summary: `Added a note on @${profile.username}`,
  });

  return { ok: true, noteId: note.id };
}

/**
 * Permanently deletes a user and everything that cascades from their Profile (posts,
 * messages, subscriptions, wallet/transaction history, live streams, etc. - see the
 * Profile model's onDelete: Cascade relations in prisma/schema.prisma). Irreversible;
 * gated behind the delete_accounts capability (SUPERADMIN only), unlike suspend.
 *
 * Two things don't cascade automatically and are handled explicitly first:
 * - AdminAuditLog.actorId and AdminNote.authorId reference User with no cascade (by
 *   design - the audit trail must survive even a deleted account), so a user who has
 *   ever taken an admin action can't be deleted at all; this is checked and refused
 *   with a clear error rather than surfacing as a raw foreign-key crash.
 * - Report.reportedUserId has no cascade either, but should survive deletion (the
 *   complaint stays on file even once the account it was about is gone) - cleared to
 *   null explicitly before the delete.
 *
 * Any un-purged verification media (government ID / selfie) is deleted from Cloudinary
 * first - the privacy policy's "deleted immediately after review" promise shouldn't stop
 * applying just because the account itself is about to disappear.
 */
export async function deleteAccountCompletely(profileId: string, actorId: string): Promise<AccountActionResult> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { username: true, userId: true, user: { select: { isAdmin: true } } },
  });
  if (!profile) {
    return { ok: false, status: 404, error: "Account not found" };
  }
  if (profile.userId === actorId) {
    return { ok: false, status: 400, error: "You can't delete your own account this way" };
  }
  if (profile.user.isAdmin) {
    return { ok: false, status: 400, error: "Remove admin access from this account before deleting it" };
  }

  const [auditActionCount, noteAuthorCount] = await Promise.all([
    prisma.adminAuditLog.count({ where: { actorId: profile.userId } }),
    prisma.adminNote.count({ where: { authorId: profile.userId } }),
  ]);
  if (auditActionCount > 0 || noteAuthorCount > 0) {
    return {
      ok: false,
      status: 400,
      error: "This account has taken admin actions on record and can't be deleted - its history must be preserved",
    };
  }

  const unpurgedVerifications = await prisma.verificationRequest.findMany({
    where: { profileId, mediaDeletedAt: null },
    select: { id: true, govIdUrl: true, selfieUrl: true },
  });
  for (const request of unpurgedVerifications) {
    await deleteVerificationMedia(request);
  }

  try {
    await prisma.report.updateMany({ where: { reportedUserId: profileId }, data: { reportedUserId: null } });
    await prisma.user.delete({ where: { id: profile.userId } });
  } catch (error) {
    console.error("[admin] account deletion failed", error);
    return {
      ok: false,
      status: 409,
      error: "Couldn't delete this account - it may still have live-request or gift history blocking the delete.",
    };
  }

  await recordAdminAction({
    actorId,
    action: "account.delete",
    targetType: "profile",
    targetId: profileId,
    summary: `Deleted @${profile.username} and all associated data`,
  });

  return { ok: true };
}
