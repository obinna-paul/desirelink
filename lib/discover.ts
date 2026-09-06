import type { AvailabilityStatusType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineDistanceKm, profileCardSelect, type ProfileCardData } from "@/lib/home-feed";
import { GENDER_OPTIONS, ORIENTATION_OPTIONS } from "@/lib/profile-options";
import { searchDocuments } from "@/lib/search";
import { rankRecommendedProfiles } from "@/lib/ranking/people-scoring";

const GENDER_FILTER_VALUES = new Set<string>(GENDER_OPTIONS);
const ORIENTATION_FILTER_VALUES = new Set<string>(ORIENTATION_OPTIONS);

export const AVAILABILITY_FILTER_OPTIONS = [
  { value: "any", label: "Any availability" },
  { value: "active", label: "Has an active status" },
  { value: "available_tonight", label: "Available tonight" },
  { value: "out_tonight", label: "Out tonight" },
  { value: "open_to_meeting", label: "Open to meeting" },
  { value: "chatting_only", label: "Chatting only" },
  { value: "couple_looking", label: "Couple looking" },
] as const;

export type AvailabilityFilterValue = (typeof AVAILABILITY_FILTER_OPTIONS)[number]["value"];

export const RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const;
export const DEFAULT_RADIUS_KM = 50;

export const DISCOVER_SORT_OPTIONS = [
  { value: "recommended", label: "Recommended for you" },
  { value: "newest", label: "Newest" },
  { value: "active", label: "Recently active" },
  { value: "distance", label: "Distance" },
] as const;

export type DiscoverSortValue = (typeof DISCOVER_SORT_OPTIONS)[number]["value"];

export const LAST_ACTIVE_FILTER_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "day", label: "Past 24 hours" },
  { value: "week", label: "Past 7 days" },
  { value: "month", label: "Past 30 days" },
] as const;

export type LastActiveFilterValue = (typeof LAST_ACTIVE_FILTER_OPTIONS)[number]["value"];

export const VERIFICATION_FILTER_OPTIONS = [
  { value: "any", label: "Any status" },
  { value: "verified", label: "Verified profiles" },
  { value: "trusted", label: "Trusted members" },
] as const;

export type VerificationFilterValue = (typeof VERIFICATION_FILTER_OPTIONS)[number]["value"];

export type DiscoverFilters = {
  query: string;
  genders: string[];
  orientations: string[];
  lastActive: LastActiveFilterValue;
  verification: VerificationFilterValue;
  radiusKm: number | null;
  availability: AvailabilityFilterValue;
  sort: DiscoverSortValue;
};

type SearchParamValue = string | string[] | undefined;
export type DiscoverSearchParams = Record<string, SearchParamValue>;

function toArray(value: SearchParamValue): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toSingle(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDiscoverFilters(searchParams: DiscoverSearchParams): DiscoverFilters {
  const radiusParam = toSingle(searchParams.radius);
  const availabilityParam = toSingle(searchParams.availability);
  const sortParam = toSingle(searchParams.sort);
  const lastActiveParam = toSingle(searchParams.lastActive);
  const verificationParam = toSingle(searchParams.verification);

  return {
    query: toSingle(searchParams.q)?.trim() ?? "",
    genders: toArray(searchParams.gender).filter((value) =>
      GENDER_FILTER_VALUES.has(value),
    ),
    orientations: toArray(searchParams.orientation).filter((value) =>
      ORIENTATION_FILTER_VALUES.has(value),
    ),
    lastActive: LAST_ACTIVE_FILTER_OPTIONS.some((option) => option.value === lastActiveParam)
      ? (lastActiveParam as LastActiveFilterValue)
      : "any",
    verification: VERIFICATION_FILTER_OPTIONS.some((option) => option.value === verificationParam)
      ? (verificationParam as VerificationFilterValue)
      : "any",
    radiusKm: radiusParam === "any" ? null : Number(radiusParam) || DEFAULT_RADIUS_KM,
    availability: AVAILABILITY_FILTER_OPTIONS.some((option) => option.value === availabilityParam)
      ? (availabilityParam as AvailabilityFilterValue)
      : "any",
    sort: DISCOVER_SORT_OPTIONS.some((option) => option.value === sortParam)
      ? (sortParam as DiscoverSortValue)
      : "recommended",
  };
}

type ViewerProfile = {
  id: string;
  locationLat: number;
  locationLng: number;
};

function hasUsableLocation(viewerProfile: ViewerProfile | null): viewerProfile is ViewerProfile {
  return Boolean(
    viewerProfile && (viewerProfile.locationLat !== 0 || viewerProfile.locationLng !== 0)
  );
}

async function buildWhere(
  filters: DiscoverFilters,
  viewerProfile: ViewerProfile | null
): Promise<Prisma.ProfileWhereInput> {
  const where: Prisma.ProfileWhereInput = { isIncognito: false, showInSearch: true, isSuspended: false };
  const and: Prisma.ProfileWhereInput[] = [];

  if (viewerProfile) {
    where.NOT = { id: viewerProfile.id };
    // Symmetric: neither a profile the viewer blocked nor one that blocked the viewer
    // should surface in search - matches the same filter already applied in
    // lib/recommendations.ts's candidate query.
    where.blocksReceived = { none: { blockerId: viewerProfile.id } };
    where.blocksMade = { none: { blockedId: viewerProfile.id } };
  }

  if (filters.query) {
    // Delegates to the shared SearchDocument index (see lib/search.ts) instead of an
    // unindexed ILIKE scan - the same text-matching engine unified search uses, so a
    // profile that shows up here shows up in /search too.
    const matches = await searchDocuments(filters.query, ["profile"]);
    where.id = { in: matches.map((match) => match.entityId) };
  }

  if (filters.genders.length > 0) {
    where.gender = { in: filters.genders };
  }

  if (filters.orientations.length > 0) {
    where.orientation = { in: filters.orientations };
  }

  if (filters.lastActive !== "any") {
    const days = filters.lastActive === "day" ? 1 : filters.lastActive === "week" ? 7 : 30;
    where.showActivityStatus = true;
    where.lastActiveAt = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  } else if (filters.sort === "active") {
    where.showActivityStatus = true;
  }

  if (filters.verification === "verified") {
    and.push({
      OR: [
        { isVerified: true },
        { isVerifiedCreator: true },
        { isTrustedMember: true },
      ],
    });
  } else if (filters.verification === "trusted") {
    where.isTrustedMember = true;
  }

  if (filters.availability === "active") {
    where.availabilityStatuses = { some: { expiresAt: { gt: new Date() } } };
  } else if (filters.availability !== "any") {
    where.availabilityStatuses = {
      some: {
        status: filters.availability as AvailabilityStatusType,
        expiresAt: { gt: new Date() },
      },
    };
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

const RESULTS_LIMIT = 30;
const DISTANCE_CANDIDATE_LIMIT = 300;

export type DiscoverResult = {
  profiles: ProfileCardData[];
  note?: string;
};

export async function searchDiscoverProfiles(
  filters: DiscoverFilters,
  viewerProfile: ViewerProfile | null
): Promise<DiscoverResult> {
  const effectiveFilters = filters;
  const where = await buildWhere(effectiveFilters, viewerProfile);
  const viewerHasLocation = hasUsableLocation(viewerProfile);
  const wantsRecommended = effectiveFilters.sort === "recommended";
  const needsInMemoryRanking =
    wantsRecommended || (viewerHasLocation && (effectiveFilters.radiusKm !== null || effectiveFilters.sort === "distance"));

  if (!needsInMemoryRanking) {
    const orderBy: Prisma.ProfileOrderByWithRelationInput =
      effectiveFilters.sort === "active" ? { lastActiveAt: "desc" } : { createdAt: "desc" };

    const profiles = await prisma.profile.findMany({
      where,
      select: profileCardSelect(),
      orderBy,
      take: RESULTS_LIMIT,
    });

    const note =
      effectiveFilters.sort === "distance" && !viewerHasLocation
        ? "Set your location on your profile to sort by distance."
        : effectiveFilters.radiusKm !== null && !viewerHasLocation
          ? "Set your location on your profile to filter by radius."
          : undefined;

    return { profiles, note };
  }

  const candidates = await prisma.profile.findMany({
    where,
    select: {
      ...profileCardSelect(),
      locationLat: true,
      locationLng: true,
      createdAt: true,
      lastActiveAt: true,
    },
    // Deterministic ordering before truncation - otherwise, once total matches exceed
    // DISTANCE_CANDIDATE_LIMIT, which rows make the cut is up to Postgres, not this query,
    // and can vary request to request even with nothing else changing.
    orderBy: { createdAt: "desc" },
    take: DISTANCE_CANDIDATE_LIMIT,
  });

  let withDistance = candidates.map((candidate) => ({
    ...candidate,
    distanceKm:
      viewerProfile && viewerHasLocation
        ? haversineDistanceKm(viewerProfile.locationLat, viewerProfile.locationLng, candidate.locationLat, candidate.locationLng)
        : undefined,
  }));

  if (effectiveFilters.radiusKm !== null && viewerHasLocation) {
    withDistance = withDistance.filter((candidate) => (candidate.distanceKm ?? Infinity) <= effectiveFilters.radiusKm!);
  }

  if (wantsRecommended) {
    const rankedIds = await rankRecommendedProfiles(viewerProfile, withDistance);
    const byId = new Map(withDistance.map((candidate) => [candidate.id, candidate]));
    withDistance = rankedIds.map((id) => byId.get(id)!);
  } else if (effectiveFilters.sort === "distance") {
    withDistance.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else if (effectiveFilters.sort === "active") {
    withDistance.sort(
      (a, b) => (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0),
    );
  } else {
    withDistance.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  return { profiles: withDistance.slice(0, RESULTS_LIMIT) };
}
