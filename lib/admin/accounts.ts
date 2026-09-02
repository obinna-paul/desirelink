import "server-only";

import { prisma } from "@/lib/prisma";
import { recordAdminAction } from "@/lib/admin/audit";

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
  ] = await Promise.all([
    prisma.post.count({ where: { authorId: profile.id, isArchived: false } }),
    prisma.post.count({ where: { authorId: profile.id, isArchived: false, isSubscriberOnly: true } }),
    prisma.subscription.count({ where: { creatorId: profile.id, status: "active" } }),
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
