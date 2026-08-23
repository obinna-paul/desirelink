import type { AvailabilityStatusType, DesireLevel, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineDistanceKm, profileCardSelect, type ProfileCardData } from "@/lib/home-feed";

export const RELATIONSHIP_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "couple", label: "Couple" },
] as const;

export type RelationshipValue = (typeof RELATIONSHIP_OPTIONS)[number]["value"];

export const CREATOR_FILTER_OPTIONS = [
  { value: "any", label: "Everyone" },
  { value: "yes", label: "Creators only" },
  { value: "no", label: "Non-creators only" },
] as const;

export type CreatorFilterValue = (typeof CREATOR_FILTER_OPTIONS)[number]["value"];

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

export type DiscoverFilters = {
  genders: string[];
  orientations: string[];
  relationship: RelationshipValue[];
  desireCategories: string[];
  desireLevel: DesireLevel | null;
  radiusKm: number | null;
  creator: CreatorFilterValue;
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
  const creatorParam = toSingle(searchParams.creator);
  const availabilityParam = toSingle(searchParams.availability);
  const sortParam = toSingle(searchParams.sort);

  return {
    genders: toArray(searchParams.gender),
    orientations: toArray(searchParams.orientation),
    relationship: toArray(searchParams.relationship).filter((value): value is RelationshipValue =>
      RELATIONSHIP_OPTIONS.some((option) => option.value === value)
    ),
    desireCategories: toArray(searchParams.desire),
    desireLevel: DESIRE_LEVEL_FILTER_OPTIONS.some((option) => option.value === desireLevelParam)
      ? (desireLevelParam as DesireLevel)
      : null,
    radiusKm: radiusParam === "any" ? null : Number(radiusParam) || DEFAULT_RADIUS_KM,
    creator: CREATOR_FILTER_OPTIONS.some((option) => option.value === creatorParam)
      ? (creatorParam as CreatorFilterValue)
      : "any",
    availability: AVAILABILITY_FILTER_OPTIONS.some((option) => option.value === availabilityParam)
      ? (availabilityParam as AvailabilityFilterValue)
      : "any",
    sort: DISCOVER_SORT_OPTIONS.some((option) => option.value === sortParam)
      ? (sortParam as DiscoverSortValue)
      : "newest",
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

  if (viewerProfile) {
    where.NOT = { id: viewerProfile.id };
  }

  if (filters.genders.length > 0) {
    where.gender = { in: filters.genders };
  }

  if (filters.orientations.length > 0) {
    where.orientation = { in: filters.orientations };
  }

  if (filters.relationship.length === 1) {
    where.isCouple = filters.relationship[0] === "couple";
  }

  if (filters.creator === "yes") {
    where.isCreator = true;
  } else if (filters.creator === "no") {
    where.isCreator = false;
  }

  if (filters.desireCategories.length > 0) {
    where.desires = {
      some: {
        category: { in: filters.desireCategories },
        ...(filters.desireLevel ? { level: filters.desireLevel } : {}),
      },
    };
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
  const where = buildWhere(filters, viewerProfile);
  const viewerHasLocation = hasUsableLocation(viewerProfile);
  const needsDistance = viewerHasLocation && (filters.radiusKm !== null || filters.sort === "distance");

  if (!needsDistance) {
    const orderBy: Prisma.ProfileOrderByWithRelationInput =
      filters.sort === "active" ? { updatedAt: "desc" } : { createdAt: "desc" };

    const profiles = await prisma.profile.findMany({
      where,
      select: profileCardSelect(),
      orderBy,
      take: RESULTS_LIMIT,
    });

    const note =
      filters.sort === "distance" && !viewerHasLocation
        ? "Set your location on your profile to sort by distance."
        : filters.radiusKm !== null && !viewerHasLocation
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

  if (filters.radiusKm !== null) {
    withDistance = withDistance.filter((candidate) => candidate.distanceKm <= filters.radiusKm!);
  }

  if (filters.sort === "distance") {
    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
  } else if (filters.sort === "active") {
    withDistance.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } else {
    withDistance.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  return { profiles: withDistance.slice(0, RESULTS_LIMIT) };
}
