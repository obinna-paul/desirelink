import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineDistanceKm } from "@/lib/home-feed";

export const EVENT_TYPE_OPTIONS = [
  "Social",
  "Party",
  "Meetup",
  "Orgy",
  "Threesome",
  "Swinging",
  "Foursome",
  "Other",
] as const;

export type EventTypeValue = (typeof EVENT_TYPE_OPTIONS)[number];

export async function getHostEvents(profileId: string) {
  return prisma.event.findMany({
    where: { hostId: profileId },
    orderBy: { startTime: "desc" },
  });
}

export async function getEventForEdit(eventId: string, hostProfileId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.hostId !== hostProfileId) return null;
  return event;
}

const eventCardInclude = {
  host: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.EventInclude;

export type UpcomingEvent = Prisma.EventGetPayload<{ include: typeof eventCardInclude }>;

type ViewerProfile = {
  id: string;
  locationLat: number;
  locationLng: number;
} | null;

function hasUsableLocation(viewerProfile: ViewerProfile): viewerProfile is NonNullable<ViewerProfile> {
  return Boolean(
    viewerProfile && (viewerProfile.locationLat !== 0 || viewerProfile.locationLng !== 0)
  );
}

/** Public events from anyone, plus the viewer's own private events — never someone else's private event. */
function visibilityWhere(viewerProfileId: string | null): Prisma.EventWhereInput {
  if (!viewerProfileId) return { isPrivate: false };
  return { OR: [{ isPrivate: false }, { isPrivate: true, hostId: viewerProfileId }] };
}

/** True if the viewer is allowed to see this event: it's public, or it's their own private event. */
export function canViewEvent(
  event: { isPrivate: boolean; hostId: string },
  viewerProfileId: string | null
): boolean {
  if (!event.isPrivate) return true;
  return viewerProfileId === event.hostId;
}

export async function getEventDetail(eventId: string, viewerProfileId: string | null) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventCardInclude,
  });
  if (!event || !canViewEvent(event, viewerProfileId)) return null;
  return event;
}

export async function getUpcomingEvents(limit = 30) {
  return prisma.event.findMany({
    where: { isPrivate: false, endTime: { gt: new Date() } },
    orderBy: { startTime: "asc" },
    take: limit,
    include: eventCardInclude,
  });
}

async function sortByDistance(
  events: UpcomingEvent[],
  viewerProfile: NonNullable<ViewerProfile>,
  limit: number
): Promise<UpcomingEvent[]> {
  return events
    .map((event) => ({
      event,
      distanceKm: haversineDistanceKm(
        viewerProfile.locationLat,
        viewerProfile.locationLng,
        event.lat,
        event.lng
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((entry) => entry.event);
}

export async function getHomeUpcomingEvents(viewerProfile: ViewerProfile, limit = 12) {
  const where: Prisma.EventWhereInput = {
    ...visibilityWhere(viewerProfile?.id ?? null),
    endTime: { gt: new Date() },
  };

  if (!hasUsableLocation(viewerProfile)) {
    return prisma.event.findMany({
      where,
      orderBy: { startTime: "asc" },
      take: limit,
      include: eventCardInclude,
    });
  }

  const candidates = await prisma.event.findMany({
    where,
    take: 200,
    include: eventCardInclude,
  });

  return sortByDistance(candidates, viewerProfile, limit);
}

export async function getTonightEvents(viewerProfile: ViewerProfile, limit = 12) {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return prisma.event.findMany({
    where: {
      ...visibilityWhere(viewerProfile?.id ?? null),
      startTime: { gte: now, lt: in24Hours },
    },
    orderBy: { startTime: "asc" },
    take: limit,
    include: eventCardInclude,
  });
}

// --- /events browse filters --------------------------------------------------

export const EVENT_DATE_PRESETS = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This weekend" },
  { value: "custom", label: "Custom range" },
] as const;

export type EventDatePreset = (typeof EVENT_DATE_PRESETS)[number]["value"];

export const EVENT_PRIVACY_FILTER_OPTIONS = [
  { value: "all", label: "Public + my private events" },
  { value: "public", label: "Public only" },
  { value: "private", label: "My private events" },
] as const;

export type EventPrivacyFilter = (typeof EVENT_PRIVACY_FILTER_OPTIONS)[number]["value"];

export const EVENT_RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const;

export type EventFilters = {
  types: string[];
  datePreset: EventDatePreset;
  customFrom: string;
  customTo: string;
  city: string;
  radiusKm: number | null;
  privacy: EventPrivacyFilter;
};

type SearchParamValue = string | string[] | undefined;
export type EventSearchParams = Record<string, SearchParamValue>;

function toArray(value: SearchParamValue): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toSingle(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseEventFilters(searchParams: EventSearchParams): EventFilters {
  const datePreset = toSingle(searchParams.date);
  const privacy = toSingle(searchParams.privacy);
  const radius = toSingle(searchParams.radius);

  return {
    types: toArray(searchParams.type).filter((value) =>
      EVENT_TYPE_OPTIONS.includes(value as EventTypeValue)
    ),
    datePreset: EVENT_DATE_PRESETS.some((option) => option.value === datePreset)
      ? (datePreset as EventDatePreset)
      : "any",
    customFrom: toSingle(searchParams.from) ?? "",
    customTo: toSingle(searchParams.to) ?? "",
    city: toSingle(searchParams.city) ?? "",
    radiusKm: radius && radius !== "any" ? Number(radius) || null : null,
    privacy: EVENT_PRIVACY_FILTER_OPTIONS.some((option) => option.value === privacy)
      ? (privacy as EventPrivacyFilter)
      : "all",
  };
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getDateRange(filters: EventFilters): { start: Date; end: Date } | null {
  const now = new Date();

  switch (filters.datePreset) {
    case "today": {
      const start = startOfDay(now);
      return { start, end: addDays(start, 1) };
    }
    case "tomorrow": {
      const start = addDays(startOfDay(now), 1);
      return { start, end: addDays(start, 1) };
    }
    case "weekend": {
      const start = startOfDay(now);
      const day = start.getDay(); // 0 = Sun, 6 = Sat
      if (day === 6) return { start, end: addDays(start, 2) };
      if (day === 0) return { start, end: addDays(start, 1) };
      const saturday = addDays(start, 6 - day);
      return { start: saturday, end: addDays(saturday, 2) };
    }
    case "custom": {
      if (!filters.customFrom) return null;
      const start = startOfDay(new Date(filters.customFrom));
      const end = filters.customTo
        ? addDays(startOfDay(new Date(filters.customTo)), 1)
        : addDays(start, 1);
      return { start, end };
    }
    default:
      return null;
  }
}

export type EventSearchResult = {
  events: UpcomingEvent[];
  note?: string;
};

const BROWSE_LIMIT = 60;
const BROWSE_DISTANCE_CANDIDATE_LIMIT = 300;

export async function searchEvents(
  filters: EventFilters,
  viewerProfile: ViewerProfile
): Promise<EventSearchResult> {
  const where: Prisma.EventWhereInput = { ...visibilityWhere(viewerProfile?.id ?? null) };

  const range = getDateRange(filters);
  if (range) {
    where.startTime = { gte: range.start, lt: range.end };
  } else {
    where.endTime = { gt: new Date() };
  }

  if (filters.types.length > 0) {
    where.eventType = { in: filters.types };
  }

  if (filters.privacy === "public") {
    where.isPrivate = false;
  } else if (filters.privacy === "private") {
    where.isPrivate = true;
  }

  if (filters.city.trim()) {
    where.city = { contains: filters.city.trim(), mode: "insensitive" };
  }

  const viewerHasLocation = hasUsableLocation(viewerProfile);
  const needsDistance = filters.radiusKm !== null && viewerHasLocation;

  if (!needsDistance) {
    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: "asc" },
      take: BROWSE_LIMIT,
      include: eventCardInclude,
    });

    const note =
      filters.radiusKm !== null && !viewerHasLocation
        ? "Set your location on your profile to filter by radius."
        : undefined;

    return { events, note };
  }

  const candidates = await prisma.event.findMany({
    where,
    take: BROWSE_DISTANCE_CANDIDATE_LIMIT,
    include: eventCardInclude,
  });

  const withinRadius = candidates
    .map((event) => ({
      event,
      distanceKm: haversineDistanceKm(
        viewerProfile!.locationLat,
        viewerProfile!.locationLng,
        event.lat,
        event.lng
      ),
    }))
    .filter((entry) => entry.distanceKm <= filters.radiusKm!)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, BROWSE_LIMIT)
    .map((entry) => entry.event);

  return { events: withinRadius };
}
