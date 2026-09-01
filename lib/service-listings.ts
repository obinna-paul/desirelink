import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineDistanceKm } from "@/lib/home-feed";
import { SERVICE_CATEGORY_OPTIONS } from "@/lib/account-types";
import type { ServiceListingInput } from "@/lib/validations/service-listing";

export async function getProviderServiceListings(providerId: string) {
  try {
    return await prisma.serviceListing.findMany({
      where: { providerId },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      console.warn("Provider service listings are unavailable until ServiceListing migrations are applied.");
      return [];
    }
    throw error;
  }
}

export type ServiceListingView = Awaited<ReturnType<typeof getProviderServiceListings>>[number];

const homeServiceListingInclude = {
  provider: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      city: true,
      country: true,
      locationLat: true,
      locationLng: true,
      isVerified: true,
      isVerifiedCreator: true,
      isVerifiedServiceProvider: true,
      isTrustedMember: true,
    },
  },
} satisfies Prisma.ServiceListingInclude;

export type HomeServiceListingView = Prisma.ServiceListingGetPayload<{
  include: typeof homeServiceListingInclude;
}>;

export async function getServiceListingById(id: string): Promise<HomeServiceListingView | null> {
  try {
    return await prisma.serviceListing.findFirst({
      where: {
        id,
        provider: { isSuspended: false },
      },
      include: homeServiceListingInclude,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      console.warn("Service listing lookup is unavailable until service listing migrations are applied.");
      return null;
    }
    throw error;
  }
}

export async function getHomeServiceListings(limit = 24): Promise<HomeServiceListingView[]> {
  try {
    return await prisma.serviceListing.findMany({
      where: {
        provider: {
          isIncognito: false,
          isSuspended: false,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: homeServiceListingInclude,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      console.warn("Home service listings are unavailable until service listing migrations are applied.");
      return [];
    }
    throw error;
  }
}

export async function createServiceListing(providerId: string, input: ServiceListingInput) {
  return prisma.serviceListing.create({ data: { providerId, ...input } });
}

export type ServiceListingActionResult = { ok: true } | { ok: false; status: number; error: string };

export async function updateServiceListing(
  id: string,
  providerId: string,
  input: ServiceListingInput
): Promise<ServiceListingActionResult> {
  const existing = await prisma.serviceListing.findUnique({ where: { id } });
  if (!existing || existing.providerId !== providerId) {
    return { ok: false, status: 404, error: "Service listing not found" };
  }

  await prisma.serviceListing.update({ where: { id }, data: input });
  return { ok: true };
}

export async function deleteServiceListing(id: string, providerId: string): Promise<ServiceListingActionResult> {
  const existing = await prisma.serviceListing.findUnique({ where: { id } });
  if (!existing || existing.providerId !== providerId) {
    return { ok: false, status: 404, error: "Service listing not found" };
  }

  await prisma.serviceListing.delete({ where: { id } });
  return { ok: true };
}

// --- /services browse filters ------------------------------------------------

export const SERVICE_RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const;

export const SERVICE_SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to high" },
  { value: "price_desc", label: "Price: High to low" },
] as const;

export type ServiceSortValue = (typeof SERVICE_SORT_OPTIONS)[number]["value"];

export type ServiceFilters = {
  categories: string[];
  minPriceCents: number | null;
  maxPriceCents: number | null;
  city: string;
  radiusKm: number | null;
  verifiedOnly: boolean;
  sort: ServiceSortValue;
};

type SearchParamValue = string | string[] | undefined;
export type ServiceSearchParams = Record<string, SearchParamValue>;

function toArray(value: SearchParamValue): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toSingle(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Naira input from the URL, converted to kobo — mirrors how the create form converts priceNaira to priceCents. */
function nairaParamToCents(value: string | undefined): number | null {
  if (!value) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

export function parseServiceFilters(searchParams: ServiceSearchParams): ServiceFilters {
  const radius = toSingle(searchParams.radius);
  const sort = toSingle(searchParams.sort);

  return {
    categories: toArray(searchParams.category).filter((value) =>
      (SERVICE_CATEGORY_OPTIONS as readonly string[]).includes(value)
    ),
    minPriceCents: nairaParamToCents(toSingle(searchParams.minPrice)),
    maxPriceCents: nairaParamToCents(toSingle(searchParams.maxPrice)),
    city: toSingle(searchParams.city) ?? "",
    radiusKm: radius && radius !== "any" ? Number(radius) || null : null,
    verifiedOnly: toSingle(searchParams.verified) !== "false",
    sort: SERVICE_SORT_OPTIONS.some((option) => option.value === sort) ? (sort as ServiceSortValue) : "newest",
  };
}

type ServiceViewerProfile = { id: string; locationLat: number; locationLng: number } | null;

function hasUsableLocation(viewerProfile: ServiceViewerProfile): viewerProfile is NonNullable<ServiceViewerProfile> {
  return Boolean(viewerProfile && (viewerProfile.locationLat !== 0 || viewerProfile.locationLng !== 0));
}

export type ServiceSearchResult = {
  listings: HomeServiceListingView[];
  note?: string;
};

const SERVICE_BROWSE_LIMIT = 60;
const SERVICE_DISTANCE_CANDIDATE_LIMIT = 300;

export async function searchServiceListings(
  filters: ServiceFilters,
  viewerProfile: ServiceViewerProfile
): Promise<ServiceSearchResult> {
  const providerWhere: Prisma.ProfileWhereInput = { isIncognito: false, isSuspended: false };
  if (filters.city.trim()) {
    providerWhere.city = { contains: filters.city.trim(), mode: "insensitive" };
  }
  if (filters.verifiedOnly) {
    providerWhere.OR = [
      { isVerifiedServiceProvider: true },
      { isVerifiedCreator: true },
      { isVerified: true },
      { isTrustedMember: true },
    ];
  }

  const where: Prisma.ServiceListingWhereInput = { provider: providerWhere };

  if (filters.categories.length > 0) {
    where.category = { in: filters.categories };
  }
  if (filters.minPriceCents !== null || filters.maxPriceCents !== null) {
    where.priceCents = {
      ...(filters.minPriceCents !== null ? { gte: filters.minPriceCents } : {}),
      ...(filters.maxPriceCents !== null ? { lte: filters.maxPriceCents } : {}),
    };
  }

  const orderBy: Prisma.ServiceListingOrderByWithRelationInput =
    filters.sort === "price_asc"
      ? { priceCents: "asc" }
      : filters.sort === "price_desc"
        ? { priceCents: "desc" }
        : { createdAt: "desc" };

  const viewerHasLocation = hasUsableLocation(viewerProfile);
  const needsDistance = filters.radiusKm !== null && viewerHasLocation;

  if (!needsDistance) {
    const listings = await prisma.serviceListing.findMany({
      where,
      orderBy,
      take: SERVICE_BROWSE_LIMIT,
      include: homeServiceListingInclude,
    });

    const note =
      filters.radiusKm !== null && !viewerHasLocation
        ? "Set your location on your profile to filter by radius."
        : undefined;

    return { listings, note };
  }

  const candidates = await prisma.serviceListing.findMany({
    where,
    orderBy,
    take: SERVICE_DISTANCE_CANDIDATE_LIMIT,
    include: homeServiceListingInclude,
  });

  const withinRadius = candidates
    .map((listing) => ({
      listing,
      distanceKm: haversineDistanceKm(
        viewerProfile!.locationLat,
        viewerProfile!.locationLng,
        listing.provider.locationLat,
        listing.provider.locationLng
      ),
    }))
    .filter((entry) => entry.distanceKm <= filters.radiusKm!)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, SERVICE_BROWSE_LIMIT)
    .map((entry) => entry.listing);

  return { listings: withinRadius };
}
