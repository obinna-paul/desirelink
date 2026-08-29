import type { DesireLevel, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineDistanceKm } from "@/lib/home-feed";
import { DESIRE_LEVEL_WEIGHT } from "@/lib/recommendations";
import { getPreferenceLabel } from "@/lib/desire-options";

const DEFAULT_EVENT_RECOMMENDATION_LIMIT = 3;
const MAX_EVENT_RECOMMENDATION_LIMIT = 12;
const EVENT_RECOMMENDATION_CANDIDATE_LIMIT = 120;

const EVENT_DESIRE_MATCHES: Record<string, string[]> = {
  Social: ["Casual Chat", "Friendship", "Community", "Meetups"],
  Party: ["Private Parties", "Events", "New Experiences", "Community"],
  Meetup: ["Meetups", "Events", "Friendship", "Community"],
  Orgy: ["Group Play", "New Experiences", "Kink Exploration"],
  Threesome: ["Group Play", "Couples Play", "New Experiences"],
  Swinging: ["Swinging", "Couples Play", "ENM"],
  Foursome: ["Group Play", "Couples Play", "Swinging"],
  Other: ["Events", "New Experiences", "Community"],
};

function viewerEventRecommendationSelect() {
  return {
    id: true,
    locationLat: true,
    locationLng: true,
    city: true,
    desires: {
      select: { category: true, level: true },
    },
  } satisfies Prisma.ProfileSelect;
}

function eventRecommendationInclude() {
  return {
    host: {
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        communityStanding: true,
      },
    },
  } satisfies Prisma.EventInclude;
}

type ViewerEventRecommendationProfile = Prisma.ProfileGetPayload<{
  select: ReturnType<typeof viewerEventRecommendationSelect>;
}>;

export type EventRecommendationData = Prisma.EventGetPayload<{
  include: ReturnType<typeof eventRecommendationInclude>;
}>;

export type EventRecommendation = {
  event: EventRecommendationData;
  compatibilityScore: number;
  reasons: string[];
};

function clampLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return DEFAULT_EVENT_RECOMMENDATION_LIMIT;
  return Math.max(1, Math.min(Math.floor(limit), MAX_EVENT_RECOMMENDATION_LIMIT));
}

function hasUsableLocation(profile: { locationLat: number; locationLng: number }) {
  return profile.locationLat !== 0 || profile.locationLng !== 0;
}

function visibleEventWhere(viewerProfileId: string): Prisma.EventWhereInput {
  return {
    OR: [{ isPrivate: false }, { isPrivate: true, hostId: viewerProfileId }],
  };
}

function scoreEventType(
  viewer: ViewerEventRecommendationProfile,
  event: EventRecommendationData
): { score: number; reasons: string[] } {
  const matchingCategories = EVENT_DESIRE_MATCHES[event.eventType] ?? [event.eventType];
  const viewerDesiresByCategory = new Map(
    viewer.desires.map((desire) => [desire.category, desire.level])
  );

  let rawScore = 0;
  let highIntentMatch = false;
  const matchedCategories: string[] = [];

  for (const category of matchingCategories) {
    const viewerLevel = viewerDesiresByCategory.get(category);
    if (!viewerLevel || viewerLevel === "hard_limit") continue;

    rawScore += DESIRE_LEVEL_WEIGHT[viewerLevel as DesireLevel];
    matchedCategories.push(category);

    if (viewerLevel === "looking" || viewerLevel === "regular") {
      highIntentMatch = true;
    }
  }

  const score = Math.max(0, Math.min(55, rawScore));
  const reasons =
    matchedCategories.length > 0
      ? [
          `${event.eventType} matches ${
            highIntentMatch ? "a strong preference" : getPreferenceLabel(matchedCategories[0])
          }`,
        ]
      : [];

  return { score, reasons };
}

function scoreEventProximity(
  viewer: ViewerEventRecommendationProfile,
  event: EventRecommendationData
): { score: number; reasons: string[] } {
  if (hasUsableLocation(viewer) && (event.lat !== 0 || event.lng !== 0)) {
    const distanceKm = haversineDistanceKm(
      viewer.locationLat,
      viewer.locationLng,
      event.lat,
      event.lng
    );

    if (distanceKm <= 5) return { score: 25, reasons: ["Very close by"] };
    if (distanceKm <= 10) return { score: 22, reasons: ["Close by"] };
    if (distanceKm <= 25) return { score: 18, reasons: ["Nearby"] };
    if (distanceKm <= 50) return { score: 14, reasons: ["Within 50km"] };
    if (distanceKm <= 100) return { score: 8, reasons: ["Within 100km"] };
    if (distanceKm <= 250) return { score: 4, reasons: ["Same region"] };
    return { score: 0, reasons: [] };
  }

  if (
    viewer.city &&
    event.city &&
    viewer.city.toLowerCase() === event.city.toLowerCase()
  ) {
    return { score: 12, reasons: [`Also in ${event.city}`] };
  }

  return { score: 0, reasons: [] };
}

function scoreHostReputation(event: EventRecommendationData): { score: number; reasons: string[] } {
  const standing = event.host.communityStanding;
  const score = Math.min(12, Math.max(0, Math.round((standing / 100) * 12)));

  return {
    score,
    reasons: standing >= 70 ? ["Hosted by a trusted member"] : [],
  };
}

function scorePopularity(event: EventRecommendationData): { score: number; reasons: string[] } {
  const capacityScore = event.maxAttendees
    ? Math.min(8, Math.round((event.currentAttendees / event.maxAttendees) * 8))
    : Math.min(8, Math.floor(event.currentAttendees / 2));

  return {
    score: Math.max(0, capacityScore),
    reasons: event.currentAttendees >= 5 ? ["Popular with members"] : [],
  };
}

function scoreEvent(
  viewer: ViewerEventRecommendationProfile,
  event: EventRecommendationData
): EventRecommendation {
  const type = scoreEventType(viewer, event);
  const proximity = scoreEventProximity(viewer, event);
  const host = scoreHostReputation(event);
  const popularity = scorePopularity(event);

  return {
    event,
    compatibilityScore: Math.round(type.score + proximity.score + host.score + popularity.score),
    reasons: [...type.reasons, ...proximity.reasons, ...host.reasons, ...popularity.reasons]
      .filter(Boolean)
      .slice(0, 3),
  };
}

export async function getRecommendedEventsForUser(
  userId: string,
  limit?: number
): Promise<EventRecommendation[] | null> {
  const viewer = await prisma.profile.findUnique({
    where: { userId },
    select: viewerEventRecommendationSelect(),
  });

  if (!viewer) return null;

  const events = await prisma.event.findMany({
    where: {
      ...visibleEventWhere(viewer.id),
      hostId: { not: viewer.id },
      endTime: { gt: new Date() },
    },
    include: eventRecommendationInclude(),
    orderBy: { startTime: "asc" },
    take: EVENT_RECOMMENDATION_CANDIDATE_LIMIT,
  });

  return events
    .map((event) => scoreEvent(viewer, event))
    .sort((a, b) => {
      if (b.compatibilityScore !== a.compatibilityScore) {
        return b.compatibilityScore - a.compatibilityScore;
      }
      return a.event.startTime.getTime() - b.event.startTime.getTime();
    })
    .slice(0, clampLimit(limit));
}
