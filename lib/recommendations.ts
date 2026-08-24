import type { AvailabilityStatusType, DesireLevel, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineDistanceKm, profileCardSelect } from "@/lib/home-feed";

const DEFAULT_RECOMMENDATION_LIMIT = 6;
const MAX_RECOMMENDATION_LIMIT = 50;
const CANDIDATE_LIMIT = 250;

export const DESIRE_LEVEL_WEIGHT: Record<DesireLevel, number> = {
  curious: 3,
  interested: 6,
  looking: 14,
  regular: 12,
  hard_limit: 0,
};

const ACTIVE_MEETING_STATUSES = new Set<AvailabilityStatusType>([
  "available_tonight",
  "open_to_meeting",
  "looking_for_event",
  "couple_looking",
]);

const ACTIVE_CHAT_STATUSES = new Set<AvailabilityStatusType>([
  "available_tonight",
  "out_tonight",
  "chatting_only",
]);

function recommendationProfileSelect() {
  return {
    ...profileCardSelect(),
    desires: {
      where: { privacy: "public" },
      select: { id: true, category: true, level: true },
    },
    locationLat: true,
    locationLng: true,
    openToChat: true,
    openToMeet: true,
    updatedAt: true,
  } satisfies Prisma.ProfileSelect;
}

function viewerProfileSelect() {
  return {
    id: true,
    locationLat: true,
    locationLng: true,
    city: true,
    country: true,
    openToChat: true,
    openToMeet: true,
    desires: {
      select: { category: true, level: true },
    },
    availabilityStatuses: {
      where: { expiresAt: { gt: new Date() } },
      select: { status: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  } satisfies Prisma.ProfileSelect;
}

export type RecommendationProfileData = Prisma.ProfileGetPayload<{
  select: ReturnType<typeof recommendationProfileSelect>;
}>;

type ViewerRecommendationProfile = Prisma.ProfileGetPayload<{
  select: ReturnType<typeof viewerProfileSelect>;
}>;

export type ProfileRecommendation = {
  profile: RecommendationProfileData;
  compatibilityScore: number;
  reasons: string[];
};

function clampLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return DEFAULT_RECOMMENDATION_LIMIT;
  return Math.max(1, Math.min(Math.floor(limit), MAX_RECOMMENDATION_LIMIT));
}

function hasUsableLocation(profile: {
  locationLat: number;
  locationLng: number;
}): boolean {
  return profile.locationLat !== 0 || profile.locationLng !== 0;
}

function scoreDesires(
  viewer: ViewerRecommendationProfile,
  candidate: RecommendationProfileData
): { score: number; reasons: string[] } {
  const viewerDesiresByCategory = new Map(
    viewer.desires.map((desire) => [desire.category, desire.level])
  );
  const viewerHardLimits = new Set(
    viewer.desires
      .filter((desire) => desire.level === "hard_limit")
      .map((desire) => desire.category)
  );

  let rawScore = 0;
  let highIntentOverlap = 0;
  const matchedCategories: string[] = [];

  for (const desire of candidate.desires) {
    const viewerLevel = viewerDesiresByCategory.get(desire.category);
    if (!viewerLevel) continue;

    if (viewerLevel === "hard_limit" || desire.level === "hard_limit") {
      rawScore -= 10;
      continue;
    }

    rawScore += DESIRE_LEVEL_WEIGHT[viewerLevel] + DESIRE_LEVEL_WEIGHT[desire.level];
    matchedCategories.push(desire.category);

    if (
      viewerLevel === "looking" ||
      viewerLevel === "regular" ||
      desire.level === "looking" ||
      desire.level === "regular"
    ) {
      highIntentOverlap += 1;
    }
  }

  for (const desire of candidate.desires) {
    if (viewerHardLimits.has(desire.category) && desire.level !== "hard_limit") {
      rawScore -= 8;
    }
  }

  const score = Math.max(0, Math.min(55, rawScore));
  const reasons =
    matchedCategories.length > 0
      ? [
          `${matchedCategories.slice(0, 2).join(", ")} ${
            highIntentOverlap > 0 ? "aligns strongly" : "overlaps"
          } in your Desire Maps`,
        ]
      : [];

  return { score, reasons };
}

function scoreProximity(
  viewer: ViewerRecommendationProfile,
  candidate: RecommendationProfileData
): { score: number; reasons: string[] } {
  if (hasUsableLocation(viewer) && hasUsableLocation(candidate)) {
    const distanceKm = haversineDistanceKm(
      viewer.locationLat,
      viewer.locationLng,
      candidate.locationLat,
      candidate.locationLng
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
    candidate.city &&
    viewer.country &&
    candidate.country &&
    viewer.city.toLowerCase() === candidate.city.toLowerCase() &&
    viewer.country.toLowerCase() === candidate.country.toLowerCase()
  ) {
    return { score: 12, reasons: [`Also in ${candidate.city}`] };
  }

  return { score: 0, reasons: [] };
}

function scoreAvailability(
  viewer: ViewerRecommendationProfile,
  candidate: RecommendationProfileData
): { score: number; reasons: string[] } {
  const viewerStatus = viewer.availabilityStatuses[0]?.status;
  const candidateStatus = candidate.availabilityStatuses[0]?.status;

  if (viewerStatus && candidateStatus) {
    if (
      (ACTIVE_MEETING_STATUSES.has(viewerStatus) && ACTIVE_MEETING_STATUSES.has(candidateStatus)) ||
      (ACTIVE_CHAT_STATUSES.has(viewerStatus) && ACTIVE_CHAT_STATUSES.has(candidateStatus))
    ) {
      return { score: 12, reasons: ["You are both available now"] };
    }

    return { score: 8, reasons: ["Both recently set availability"] };
  }

  if ((viewer.openToChat && candidate.openToChat) || (viewer.openToMeet && candidate.openToMeet)) {
    return { score: 5, reasons: ["Your availability preferences line up"] };
  }

  if (candidateStatus) {
    return { score: 3, reasons: ["They are active now"] };
  }

  return { score: 0, reasons: [] };
}

function scoreActivity(updatedAt: Date): { score: number; reasons: string[] } {
  const ageDays = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays <= 1) return { score: 8, reasons: ["Active today"] };
  if (ageDays <= 7) return { score: 6, reasons: ["Active this week"] };
  if (ageDays <= 30) return { score: 3, reasons: ["Active recently"] };
  return { score: 0, reasons: [] };
}

function scoreCandidate(
  viewer: ViewerRecommendationProfile,
  candidate: RecommendationProfileData
): ProfileRecommendation {
  const desire = scoreDesires(viewer, candidate);
  const proximity = scoreProximity(viewer, candidate);
  const availability = scoreAvailability(viewer, candidate);
  const activity = scoreActivity(candidate.updatedAt);

  const compatibilityScore = Math.round(
    desire.score + proximity.score + availability.score + activity.score
  );

  return {
    profile: candidate,
    compatibilityScore,
    reasons: [...desire.reasons, ...proximity.reasons, ...availability.reasons, ...activity.reasons]
      .filter(Boolean)
      .slice(0, 3),
  };
}

export async function getPersonalizedRecommendations(
  userId: string,
  limit?: number
): Promise<ProfileRecommendation[] | null> {
  const viewer = await prisma.profile.findUnique({
    where: { userId },
    select: viewerProfileSelect(),
  });

  if (!viewer) return null;

  const candidates = await prisma.profile.findMany({
    where: {
      id: { not: viewer.id },
      isIncognito: false,
      showInSearch: true,
      blocksReceived: { none: { blockerId: viewer.id } },
      blocksMade: { none: { blockedId: viewer.id } },
    },
    select: recommendationProfileSelect(),
    orderBy: { updatedAt: "desc" },
    take: CANDIDATE_LIMIT,
  });

  return candidates
    .map((candidate) => scoreCandidate(viewer, candidate))
    .sort((a, b) => {
      if (b.compatibilityScore !== a.compatibilityScore) {
        return b.compatibilityScore - a.compatibilityScore;
      }
      return b.profile.updatedAt.getTime() - a.profile.updatedAt.getTime();
    })
    .slice(0, clampLimit(limit));
}
