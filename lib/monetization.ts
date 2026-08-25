import "server-only";

import type { ProfileType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { METRIC_TYPES } from "@/lib/rewards/points";

type MonetizationConfig = {
  minAccountAgeDays: number;
  minFans: number;
  minContentItems: number;
  contentLabel: string;
  minActivityEvents: number;
  activityWindowDays: number;
};

/**
 * Still a lot less strict than YouTube's Partner Program (1,000 subscribers +
 * 4,000 watch hours), but no longer trivial: a month of account history, a
 * real base of Fans, some published content, and — standing in for YouTube's
 * watch hours as a measure of actual activity rather than time-in-app —
 * a minimum count of tracked engagement from Premium users over a rolling
 * window (see getActivityScore below). This only gates eligibility for the
 * platform-funded rewards pool — a provider's own Fan (tier subscriber)
 * revenue is never affected, monetized or not.
 */
const MONETIZATION_REQUIREMENTS: Record<"CREATOR" | "PAIR" | "SERVICE_PROVIDER", MonetizationConfig> = {
  CREATOR: {
    minAccountAgeDays: 30,
    minFans: 25,
    minContentItems: 10,
    contentLabel: "posts",
    minActivityEvents: 100,
    activityWindowDays: 60,
  },
  PAIR: {
    // Posting isn't wired up for Pair accounts yet (app/api/posts gates to
    // CREATOR only), so a content requirement would make monetization
    // unreachable for them — left at 0 until that feature exists.
    minAccountAgeDays: 30,
    minFans: 25,
    minContentItems: 0,
    contentLabel: "posts",
    minActivityEvents: 100,
    activityWindowDays: 60,
  },
  SERVICE_PROVIDER: {
    minAccountAgeDays: 30,
    minFans: 10,
    minContentItems: 3,
    contentLabel: "service listings",
    minActivityEvents: 100,
    activityWindowDays: 60,
  },
};

async function getFanCount(providerId: string): Promise<number> {
  const now = new Date();
  const [tierFans, legacyFans] = await Promise.all([
    prisma.providerSubscription.count({ where: { providerId, status: "active", endsAt: { gt: now } } }),
    prisma.subscription.count({ where: { creatorId: providerId, status: "active", endsAt: { gt: now } } }),
  ]);
  return tierFans + legacyFans;
}

async function getContentCount(providerId: string, profileType: ProfileType): Promise<number> {
  if (profileType === "SERVICE_PROVIDER") {
    return prisma.serviceListing.count({ where: { providerId } });
  }
  return prisma.post.count({ where: { authorId: providerId } });
}

/**
 * Udala's equivalent of YouTube's watch hours: total tracked engagement from
 * Premium users over a rolling window (content views, profile views, message
 * replies, event RSVPs, service views/bookings, couple-interest signals) —
 * the same signal that feeds the rewards pool (lib/rewards). Excludes
 * subscriber_retention, which isn't Premium-user activity but a per-Fan
 * credit (see lib/rewards/tracking.ts) and would let a provider inflate this
 * score just by having Fans, defeating the point of a separate depth signal.
 */
async function getActivityScore(providerId: string, windowDays: number): Promise<number> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const result = await prisma.engagementMetric.aggregate({
    where: { providerId, createdAt: { gte: since }, metricType: { not: METRIC_TYPES.SUBSCRIBER_RETENTION } },
    _sum: { value: true },
  });
  return result._sum.value ?? 0;
}

export type MonetizationRequirement =
  | { key: string; label: string; met: boolean; kind: "count"; current: number; required: number }
  | { key: string; label: string; met: boolean; kind: "status"; detail: string };

export type MonetizationEligibility = {
  isMonetized: boolean;
  monetizationStatus: string;
  monetizedAt: Date | null;
  pendingApplicationSince: Date | null;
  eligible: boolean;
  requirements: MonetizationRequirement[];
};

export async function getMonetizationEligibility(providerId: string): Promise<MonetizationEligibility | null> {
  const profile = await prisma.profile.findUnique({ where: { id: providerId } });
  if (!profile || !isProviderProfileType(profile.profileType)) return null;

  const config = MONETIZATION_REQUIREMENTS[profile.profileType as "CREATOR" | "PAIR" | "SERVICE_PROVIDER"];
  const accountAgeDays = Math.floor((Date.now() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const [fanCount, contentCount, activityScore, pendingApplication] = await Promise.all([
    getFanCount(providerId),
    getContentCount(providerId, profile.profileType),
    getActivityScore(providerId, config.activityWindowDays),
    prisma.monetizationApplication.findFirst({
      where: { providerId, status: "pending" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const requirements: MonetizationRequirement[] = [
    {
      key: "account_age",
      label: "Account age (days)",
      kind: "count",
      met: accountAgeDays >= config.minAccountAgeDays,
      current: accountAgeDays,
      required: config.minAccountAgeDays,
    },
    {
      key: "fans",
      label: "Fans",
      kind: "count",
      met: fanCount >= config.minFans,
      current: fanCount,
      required: config.minFans,
    },
  ];

  if (config.minContentItems > 0) {
    requirements.push({
      key: "content",
      label: config.contentLabel[0].toUpperCase() + config.contentLabel.slice(1),
      kind: "count",
      met: contentCount >= config.minContentItems,
      current: contentCount,
      required: config.minContentItems,
    });
  }

  requirements.push({
    key: "activity",
    label: `Premium-user engagement (last ${config.activityWindowDays} days)`,
    kind: "count",
    met: activityScore >= config.minActivityEvents,
    current: activityScore,
    required: config.minActivityEvents,
  });

  requirements.push({
    key: "standing",
    label: "Account standing",
    kind: "status",
    met: !profile.isSuspended,
    detail: profile.isSuspended ? "Account is suspended" : "Good standing",
  });

  const eligible = profile.monetizationStatus !== "suspended" && requirements.every((requirement) => requirement.met);

  return {
    isMonetized: profile.isMonetized,
    monetizationStatus: profile.monetizationStatus,
    monetizedAt: profile.monetizedAt,
    pendingApplicationSince: pendingApplication?.createdAt ?? null,
    eligible,
    requirements,
  };
}

export type ApplyForMonetizationResult =
  | { ok: true; state: "already_monetized" | "pending"; eligibility: MonetizationEligibility }
  | { ok: false; status: number; error: string; requirements: MonetizationRequirement[] };

/**
 * Submits a monetization application. Meeting the automated requirements
 * checklist only unlocks submission — an admin still has to approve it
 * (see approveMonetizationApplication) before isMonetized flips to true.
 */
export async function applyForMonetization(providerId: string): Promise<ApplyForMonetizationResult> {
  const eligibility = await getMonetizationEligibility(providerId);
  if (!eligibility) {
    return { ok: false, status: 404, error: "Provider not found", requirements: [] };
  }
  if (eligibility.isMonetized) {
    return { ok: true, state: "already_monetized", eligibility };
  }
  if (eligibility.monetizationStatus === "suspended") {
    return {
      ok: false,
      status: 403,
      error: "Monetization was suspended for this account. Contact support to appeal.",
      requirements: eligibility.requirements,
    };
  }
  if (eligibility.pendingApplicationSince) {
    return { ok: true, state: "pending", eligibility };
  }
  if (!eligibility.eligible) {
    return {
      ok: false,
      status: 400,
      error: "This account doesn't meet the monetization requirements yet.",
      requirements: eligibility.requirements,
    };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.monetizationApplication.create({ data: { providerId, status: "pending" } }),
    prisma.profile.update({ where: { id: providerId }, data: { monetizationStatus: "pending" } }),
  ]);

  return {
    ok: true,
    state: "pending",
    eligibility: { ...eligibility, monetizationStatus: "pending", pendingApplicationSince: now },
  };
}

export type PendingMonetizationApplication = {
  id: string;
  createdAt: Date;
  provider: { id: string; username: string; displayName: string; avatarUrl: string; profileType: ProfileType };
};

/** All pending monetization applications, oldest first — for the admin review queue. */
export async function getPendingMonetizationApplications(): Promise<PendingMonetizationApplication[]> {
  return prisma.monetizationApplication.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      provider: { select: { id: true, username: true, displayName: true, avatarUrl: true, profileType: true } },
    },
  });
}

export type ReviewMonetizationApplicationResult = { ok: true } | { ok: false; status: number; error: string };

async function requirePendingApplication(applicationId: string) {
  const application = await prisma.monetizationApplication.findUnique({ where: { id: applicationId } });
  if (!application) return { ok: false as const, status: 404, error: "Application not found" };
  if (application.status !== "pending") return { ok: false as const, status: 409, error: "Application already reviewed" };
  return { ok: true as const, application };
}

/** Admin approves a pending application: the provider becomes monetized immediately. */
export async function approveMonetizationApplication(
  applicationId: string,
  reviewerId: string
): Promise<ReviewMonetizationApplicationResult> {
  const found = await requirePendingApplication(applicationId);
  if (!found.ok) return found;

  const reviewedAt = new Date();
  await prisma.$transaction([
    prisma.monetizationApplication.update({
      where: { id: applicationId },
      data: { status: "approved", reviewedById: reviewerId, reviewedAt },
    }),
    prisma.profile.update({
      where: { id: found.application.providerId },
      data: { isMonetized: true, monetizedAt: reviewedAt, monetizationStatus: "monetized" },
    }),
  ]);

  return { ok: true };
}

/** Admin denies a pending application. The provider can submit a new one later. */
export async function denyMonetizationApplication(
  applicationId: string,
  reviewerId: string
): Promise<ReviewMonetizationApplicationResult> {
  const found = await requirePendingApplication(applicationId);
  if (!found.ok) return found;

  const reviewedAt = new Date();
  await prisma.$transaction([
    prisma.monetizationApplication.update({
      where: { id: applicationId },
      data: { status: "denied", reviewedById: reviewerId, reviewedAt },
    }),
    prisma.profile.update({ where: { id: found.application.providerId }, data: { monetizationStatus: "denied" } }),
  ]);

  return { ok: true };
}

export type SetMonetizationSuspendedResult = { ok: true } | { ok: false; status: number; error: string };

/** Admin action mirroring YouTube's ability to demonetize a channel for policy violations. */
export async function setMonetizationSuspended(
  providerId: string,
  suspended: boolean
): Promise<SetMonetizationSuspendedResult> {
  const profile = await prisma.profile.findUnique({ where: { id: providerId }, select: { id: true } });
  if (!profile) {
    return { ok: false, status: 404, error: "Provider not found" };
  }

  await prisma.profile.update({
    where: { id: providerId },
    data: suspended
      ? { isMonetized: false, monetizationStatus: "suspended" }
      : { monetizationStatus: "none" },
  });

  return { ok: true };
}

export type MonetizedProviderSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  profileType: ProfileType;
  monetizationStatus: string;
  monetizedAt: Date | null;
};

/** Every provider that is currently monetized or has had monetization suspended — for the admin panel. */
export async function getMonetizedProviders(): Promise<MonetizedProviderSummary[]> {
  return prisma.profile.findMany({
    where: { OR: [{ isMonetized: true }, { monetizationStatus: "suspended" }] },
    orderBy: { monetizedAt: "desc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      profileType: true,
      monetizationStatus: true,
      monetizedAt: true,
    },
  });
}
