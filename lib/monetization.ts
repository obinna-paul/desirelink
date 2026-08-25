import "server-only";

import type { ProfileType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";

type MonetizationConfig = {
  minAccountAgeDays: number;
  minFans: number;
  minContentItems: number;
  contentLabel: string;
};

/**
 * Deliberately a lot less strict than YouTube's Partner Program (1,000
 * subscribers + 4,000 watch hours): a handful of Fans, a few days of account
 * history, and a bit of content is enough. This only gates eligibility for
 * the platform-funded rewards pool — a provider's own Fan (tier subscriber)
 * revenue is never affected, monetized or not.
 */
const MONETIZATION_REQUIREMENTS: Record<"CREATOR" | "PAIR" | "SERVICE_PROVIDER", MonetizationConfig> = {
  CREATOR: { minAccountAgeDays: 7, minFans: 3, minContentItems: 3, contentLabel: "posts" },
  PAIR: { minAccountAgeDays: 7, minFans: 3, minContentItems: 0, contentLabel: "posts" },
  SERVICE_PROVIDER: { minAccountAgeDays: 7, minFans: 3, minContentItems: 1, contentLabel: "service listings" },
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

export type MonetizationRequirement =
  | { key: string; label: string; met: boolean; kind: "count"; current: number; required: number }
  | { key: string; label: string; met: boolean; kind: "status"; detail: string };

export type MonetizationEligibility = {
  isMonetized: boolean;
  monetizationStatus: string;
  monetizedAt: Date | null;
  eligible: boolean;
  requirements: MonetizationRequirement[];
};

export async function getMonetizationEligibility(providerId: string): Promise<MonetizationEligibility | null> {
  const profile = await prisma.profile.findUnique({ where: { id: providerId } });
  if (!profile || !isProviderProfileType(profile.profileType)) return null;

  const config = MONETIZATION_REQUIREMENTS[profile.profileType as "CREATOR" | "PAIR" | "SERVICE_PROVIDER"];
  const accountAgeDays = Math.floor((Date.now() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const [fanCount, contentCount] = await Promise.all([
    getFanCount(providerId),
    getContentCount(providerId, profile.profileType),
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
    eligible,
    requirements,
  };
}

export type ApplyForMonetizationResult =
  | { ok: true; eligibility: MonetizationEligibility }
  | { ok: false; status: number; error: string; requirements: MonetizationRequirement[] };

export async function applyForMonetization(providerId: string): Promise<ApplyForMonetizationResult> {
  const eligibility = await getMonetizationEligibility(providerId);
  if (!eligibility) {
    return { ok: false, status: 404, error: "Provider not found", requirements: [] };
  }
  if (eligibility.isMonetized) {
    return { ok: true, eligibility };
  }
  if (eligibility.monetizationStatus === "suspended") {
    return {
      ok: false,
      status: 403,
      error: "Monetization was suspended for this account. Contact support to appeal.",
      requirements: eligibility.requirements,
    };
  }
  if (!eligibility.eligible) {
    return {
      ok: false,
      status: 400,
      error: "This account doesn't meet the monetization requirements yet.",
      requirements: eligibility.requirements,
    };
  }

  const monetizedAt = new Date();
  await prisma.profile.update({
    where: { id: providerId },
    data: { isMonetized: true, monetizedAt, monetizationStatus: "monetized" },
  });

  return {
    ok: true,
    eligibility: { ...eligibility, isMonetized: true, monetizedAt, monetizationStatus: "monetized" },
  };
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
