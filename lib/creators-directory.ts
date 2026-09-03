import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TIER_TYPE_VALUES } from "@/lib/validations/creator-tier";

export const CREATOR_DIRECTORY_SORT_OPTIONS = [
  { value: "newest", label: "Newest creators" },
  { value: "subscribers", label: "Most subscribers" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
] as const;

export type CreatorDirectorySortValue = (typeof CREATOR_DIRECTORY_SORT_OPTIONS)[number]["value"];

export const CREATOR_DIRECTORY_TIER_TYPE_OPTIONS = TIER_TYPE_VALUES;

export type CreatorDirectoryFilters = {
  query: string;
  tierTypes: string[];
  sort: CreatorDirectorySortValue;
};

type SearchParamValue = string | string[] | undefined;
export type CreatorDirectorySearchParams = Record<string, SearchParamValue>;

function toArray(value: SearchParamValue): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toSingle(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCreatorDirectoryFilters(
  searchParams: CreatorDirectorySearchParams,
): CreatorDirectoryFilters {
  const sortParam = toSingle(searchParams.sort);

  return {
    query: toSingle(searchParams.q)?.trim() ?? "",
    tierTypes: toArray(searchParams.tierType).filter((value) =>
      (CREATOR_DIRECTORY_TIER_TYPE_OPTIONS as readonly string[]).includes(value),
    ),
    sort: CREATOR_DIRECTORY_SORT_OPTIONS.some((option) => option.value === sortParam)
      ? (sortParam as CreatorDirectorySortValue)
      : "newest",
  };
}

export type SubscribableCreator = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isVerified: boolean;
  isVerifiedCreator: boolean;
  minTierPriceCents: number;
  tierCount: number;
  subscriberCount: number;
  createdAt: Date;
};

const RESULTS_LIMIT = 30;
const CANDIDATE_LIMIT = 300;

function buildWhere(filters: CreatorDirectoryFilters): Prisma.ProfileWhereInput {
  const and: Prisma.ProfileWhereInput[] = [
    { OR: [{ isVerified: true }, { isVerifiedCreator: true }] },
    { creatorTiers: { some: filters.tierTypes.length > 0 ? { tierType: { in: filters.tierTypes } } : {} } },
    { posts: { some: { isSubscriberOnly: true, isArchived: false } } },
  ];

  if (filters.query) {
    and.push({
      OR: [
        { username: { contains: filters.query, mode: "insensitive" } },
        { displayName: { contains: filters.query, mode: "insensitive" } },
      ],
    });
  }

  return {
    profileType: "CREATOR",
    isIncognito: false,
    isSuspended: false,
    AND: and,
  };
}

/**
 * Creators someone can actually subscribe to for premium content: verified, with at least
 * one priced tier, and with at least one premium post already published - i.e. subscribing
 * to them would show something in the subscriber's Premium tab. Only reachable from the
 * "Find creators" prompt on that tab, not linked from primary navigation.
 */
export async function searchSubscribableCreators(
  filters: CreatorDirectoryFilters,
): Promise<SubscribableCreator[]> {
  const where = buildWhere(filters);

  const candidates = await prisma.profile.findMany({
    where,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isVerified: true,
      isVerifiedCreator: true,
      createdAt: true,
      creatorTiers: { select: { priceCents: true } },
      _count: { select: { subscriptionsAsCreator: { where: { status: "active" } } } },
    },
    take: CANDIDATE_LIMIT,
  });

  const creators: SubscribableCreator[] = candidates.map((candidate) => ({
    id: candidate.id,
    username: candidate.username,
    displayName: candidate.displayName,
    avatarUrl: candidate.avatarUrl,
    isVerified: candidate.isVerified,
    isVerifiedCreator: candidate.isVerifiedCreator,
    minTierPriceCents: Math.min(...candidate.creatorTiers.map((tier) => tier.priceCents)),
    tierCount: candidate.creatorTiers.length,
    subscriberCount: candidate._count.subscriptionsAsCreator,
    createdAt: candidate.createdAt,
  }));

  switch (filters.sort) {
    case "subscribers":
      creators.sort((a, b) => b.subscriberCount - a.subscriberCount);
      break;
    case "price_low":
      creators.sort((a, b) => a.minTierPriceCents - b.minTierPriceCents);
      break;
    case "price_high":
      creators.sort((a, b) => b.minTierPriceCents - a.minTierPriceCents);
      break;
    case "newest":
    default:
      creators.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
  }

  return creators.slice(0, RESULTS_LIMIT);
}
