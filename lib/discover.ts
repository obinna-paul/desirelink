import type { AvailabilityStatusType, DesireLevel, Prisma, ProfileType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineDistanceKm, profileCardSelect, type ProfileCardData } from "@/lib/home-feed";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";

export const ACCOUNT_TYPE_FILTER_OPTIONS = ACCOUNT_TYPE_OPTIONS.map(({ value, label }) => ({
  value,
  label,
}));

export const PROVIDER_TYPE_FILTER_OPTIONS = ACCOUNT_TYPE_FILTER_OPTIONS.filter(
  (option) => option.value !== "EXPLORER"
);

export const AVAILABILITY_FILTER_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "active", label: "Currently active (any status)" },
  { value: "available_tonight", label: "Available tonight" },
  { value: "out_tonight", label: "Out tonight" },
  { value: "open_to_meeting", label: "Open to meeting" },
  { value: "chatting_only", label: "Chatting only" },
  { value: "looking_for_event", label: "Looking for an event" },
  { value: "couple_looking", label: "Couple looking" },
] as const;

export type AvailabilityFilterValue = (typeof AVAILABILITY_FILTER_OPTIONS)[number]["value"];

export const RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const;
export const DEFAULT_RADIUS_KM = 50;

export const DESIRE_LEVEL_FILTER_OPTIONS: { value: DesireLevel; label: string }[] = [
  { value: "curious", label: "Curious about" },
  { value: "interested", label: "Interested in" },
  { value: "looking", label: "Looking for" },
  { value: "regular", label: "Regularly enjoy" },
  { value: "hard_limit", label: "Hard limit" },
];

export const DISCOVER_SORT_OPTIONS = [
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

export const BODY_TYPE_FILTER_OPTIONS = [
  "Slim",
  "Athletic",
  "Average",
  "Curvy",
  "Plus-size",
] as const;

export const VERIFICATION_FILTER_OPTIONS = [
  { value: "any", label: "Any status" },
  { value: "verified", label: "Verified" },
  { value: "trusted", label: "Trusted member" },
  { value: "verified_creator", label: "Verified creator" },
  { value: "verified_host", label: "Verified host" },
] as const;

export type VerificationFilterValue = (typeof VERIFICATION_FILTER_OPTIONS)[number]["value"];

export type DiscoverFilters = {
  genders: string[];
  orientations: string[];
  accountTypes: ProfileType[];
  desireCategories: string[];
  desireLevel: DesireLevel | null;
  bodyTypes: string[];
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
  const desireLevelParam = toSingle(searchParams.desireLevel);
  const availabilityParam = toSingle(searchParams.availability);
  const sortParam = toSingle(searchParams.sort);
  const lastActiveParam = toSingle(searchParams.lastActive);
  const verificationParam = toSingle(searchParams.verification);

  return {
    genders: toArray(searchParams.gender),
    orientations: toArray(searchParams.orientation),
    accountTypes: toArray(searchParams.accountType).filter((value): value is ProfileType =>
      ACCOUNT_TYPE_FILTER_OPTIONS.some((option) => option.value === value)
    ),
    desireCategories: toArray(searchParams.desire),
    desireLevel: DESIRE_LEVEL_FILTER_OPTIONS.some((option) => option.value === desireLevelParam)
      ? (desireLevelParam as DesireLevel)
      : null,
    bodyTypes: toArray(searchParams.bodyType),
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
      : "newest",
  };
}

export function hasAdvancedDiscoverFilters(filters: DiscoverFilters): boolean {
  return Boolean(
    filters.accountTypes.length > 0 ||
      filters.desireCategories.length > 0 ||
      filters.desireLevel ||
      filters.bodyTypes.length > 0 ||
      filters.lastActive !== "any" ||
      filters.verification !== "any"
  );
}

export function withoutAdvancedDiscoverFilters(filters: DiscoverFilters): DiscoverFilters {
  return {
    ...filters,
    accountTypes: [],
    desireCategories: [],
    desireLevel: null,
    bodyTypes: [],
    lastActive: "any",
    verification: "any",
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

function buildWhere(
  filters: DiscoverFilters,
  viewerProfile: ViewerProfile | null
): Prisma.ProfileWhereInput {
  const where: Prisma.ProfileWhereInput = { isIncognito: false };
  const and: Prisma.ProfileWhereInput[] = [];

  if (viewerProfile) {
    where.NOT = { id: viewerProfile.id };
  }

  if (filters.genders.length > 0) {
    where.gender = { in: filters.genders };
  }

  if (filters.orientations.length > 0) {
    where.orientation = { in: filters.orientations };
  }

  if (filters.accountTypes.length > 0) {
    where.profileType = { in: filters.accountTypes };
  }

  if (filters.desireCategories.length > 0) {
    where.desires = {
      some: {
        category: { in: filters.desireCategories },
        ...(filters.desireLevel ? { level: filters.desireLevel } : {}),
      },
    };
  }

  if (filters.bodyTypes.length > 0) {
    and.push({
      OR: filters.bodyTypes.map((bodyType) => ({
        bio: { contains: bodyType, mode: "insensitive" },
      })),
    });
  }

  if (filters.lastActive !== "any") {
    const days = filters.lastActive === "day" ? 1 : filters.lastActive === "week" ? 7 : 30;
    where.updatedAt = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  }

  if (filters.verification === "verified") {
    and.push({
      OR: [
        { isVerified: true },
        { isVerifiedCreator: true },
        { isVerifiedHost: true },
        { isTrustedMember: true },
      ],
    });
  } else if (filters.verification === "trusted") {
    where.isTrustedMember = true;
  } else if (filters.verification === "verified_creator") {
    where.isVerifiedCreator = true;
  } else if (filters.verification === "verified_host") {
    where.isVerifiedHost = true;
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
  viewerProfile: ViewerProfile | null,
  isPremium = false
): Promise<DiscoverResult> {
  const advancedFiltersIgnored = !isPremium && hasAdvancedDiscoverFilters(filters);
  const effectiveFilters = advancedFiltersIgnored ? withoutAdvancedDiscoverFilters(filters) : filters;
  const where = buildWhere(effectiveFilters, viewerProfile);
  const viewerHasLocation = hasUsableLocation(viewerProfile);
  const needsDistance =
    viewerHasLocation && (effectiveFilters.radiusKm !== null || effectiveFilters.sort === "distance");
  const advancedNote = advancedFiltersIgnored
    ? "Advanced filters are available with udala premium."
    : undefined;

  if (!needsDistance) {
    const orderBy: Prisma.ProfileOrderByWithRelationInput =
      effectiveFilters.sort === "active" ? { updatedAt: "desc" } : { createdAt: "desc" };

    const profiles = await prisma.profile.findMany({
      where,
      select: profileCardSelect(),
      orderBy,
      take: RESULTS_LIMIT,
    });

    const note =
      advancedNote ??
      (effectiveFilters.sort === "distance" && !viewerHasLocation
        ? "Set your location on your profile to sort by distance."
        : effectiveFilters.radiusKm !== null && !viewerHasLocation
          ? "Set your location on your profile to filter by radius."
          : undefined);

    return { profiles, note };
  }

  const candidates = await prisma.profile.findMany({
    where,
    select: {
      ...profileCardSelect(),
      locationLat: true,
      locationLng: true,
      createdAt: true,
      updatedAt: true,
    },
    take: DISTANCE_CANDIDATE_LIMIT,
  });

  let withDistance = candidates.map((candidate) => ({
    ...candidate,
    distanceKm: haversineDistanceKm(
      viewerProfile.locationLat,
      viewerProfile.locationLng,
      candidate.locationLat,
      candidate.locationLng
    ),
  }));

  if (effectiveFilters.radiusKm !== null) {
    withDistance = withDistance.filter((candidate) => candidate.distanceKm <= effectiveFilters.radiusKm!);
  }

  if (effectiveFilters.sort === "distance") {
    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
  } else if (effectiveFilters.sort === "active") {
    withDistance.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } else {
    withDistance.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  return { profiles: withDistance.slice(0, RESULTS_LIMIT), note: advancedNote };
}
