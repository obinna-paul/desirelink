import type { AvailabilityStatusType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineDistanceKm, profileCardSelect, type ProfileCardData } from "@/lib/home-feed";
import { scoreReciprocalSpecCompatibility } from "@/lib/spec-test/vector-compatibility";
import { normalizeMatchPriority } from "@/lib/match-priority";

const DEFAULT_RECOMMENDATION_LIMIT = 6;
const MAX_RECOMMENDATION_LIMIT = 50;
const CANDIDATE_LIMIT = 250;

const ACTIVE_MEETING_STATUSES = new Set<AvailabilityStatusType>([
  "available_tonight",
  "open_to_meeting",
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
    matchPriority: true,
    specTestResults: {
      select: {
        specType: true,
        assumedAttractionTarget: true,
        secondarySpec: true,
        sparkSpec: true,
        partnershipSpec: true,
        motiveScores: true,
        lenses: true,
        attachment: true,
      },
      orderBy: { createdAt: "desc" as const },
      take: 1,
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
    matchPriority: true,
    availabilityStatuses: {
      where: { expiresAt: { gt: new Date() } },
      select: { status: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
    specTestResults: {
      select: {
        specType: true,
        secondarySpec: true,
        sparkSpec: true,
        partnershipSpec: true,
        motiveScores: true,
        lenses: true,
        attachment: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  } satisfies Prisma.ProfileSelect;
}

type RankableRecommendationProfileData = Prisma.ProfileGetPayload<{
  select: ReturnType<typeof recommendationProfileSelect>;
}>;

export type RecommendationProfileData = ProfileCardData;

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

function scoreProximity(
  viewer: ViewerRecommendationProfile,
  candidate: RankableRecommendationProfileData
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
  candidate: RankableRecommendationProfileData
): { score: number; reasons: string[] } {
  const viewerStatus = viewer.availabilityStatuses[0]?.status;
  const candidateStatus = candidate.availabilityStatuses[0]?.status;

  if (viewerStatus && candidateStatus) {
    const viewerIsTonight = viewerStatus === "available_tonight" || viewerStatus === "out_tonight";
    const candidateIsTonight = candidateStatus === "available_tonight" || candidateStatus === "out_tonight";
    if (viewerIsTonight && candidateIsTonight) {
      return { score: 20, reasons: ["Also available tonight"] };
    }

    if (
      (ACTIVE_MEETING_STATUSES.has(viewerStatus) && ACTIVE_MEETING_STATUSES.has(candidateStatus)) ||
      (ACTIVE_CHAT_STATUSES.has(viewerStatus) && ACTIVE_CHAT_STATUSES.has(candidateStatus))
    ) {
      return { score: 12, reasons: ["You are both available now"] };
    }

    return { score: 8, reasons: ["Both recently set availability"] };
  }

  if ((viewer.openToChat && candidate.openToChat) || (viewer.openToMeet && candidate.openToMeet)) {
    return { score: 5, reasons: ["Your availability overlaps"] };
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

/** The "preference overlap" this section's own subtitle already promises. Scores both
 * directions with each person's own priority, using continuous Spec vectors where possible
 * and the provisional archetype table only for legacy rows.
 * Capped below proximity's top score (25) because matching outcomes are not yet validated,
 * but above availability's top (12) - this is meant to matter, not be a tiebreaker. Missing
 * Spec data contributes 0, same as every other term when its signal is absent. */
function scoreSpec(
  viewer: ViewerRecommendationProfile,
  candidate: RankableRecommendationProfileData,
): { score: number; reasons: string[] } {
  const priority = normalizeMatchPriority(viewer.matchPriority);
  const compatibility = scoreReciprocalSpecCompatibility(
    viewer.specTestResults,
    candidate.specTestResults,
    priority,
    normalizeMatchPriority(candidate.matchPriority),
  );
  const weight = compatibility.score;
  if (weight <= 0) return { score: 0, reasons: [] };

  const maxScore = priority === "BALANCED" ? 15 : 20;
  const score = Math.round(weight * maxScore);
  if (score <= 0) return { score: 0, reasons: [] };

  const reason = compatibility.reason;
  return { score, reasons: reason ? [reason] : [] };
}

function scoreCandidate(
  viewer: ViewerRecommendationProfile,
  candidate: RankableRecommendationProfileData
): ProfileRecommendation & { candidateUpdatedAt: Date } {
  const proximity = scoreProximity(viewer, candidate);
  const availability = scoreAvailability(viewer, candidate);
  const activity = scoreActivity(candidate.updatedAt);
  const spec = scoreSpec(viewer, candidate);

  const compatibilityScore = Math.round(proximity.score + availability.score + activity.score + spec.score);

  // Ranking requires private vector details and exact coordinates, but the returned profile
  // crosses a server/client boundary. Project back to the established public card shape so
  // internal Spec signals (and ranking-only location fields) can never leak through JSON.
  const {
    locationLat,
    locationLng,
    openToChat,
    openToMeet,
    updatedAt,
    matchPriority,
    specTestResults,
    ...publicProfile
  } = candidate;
  void locationLat;
  void locationLng;
  void openToChat;
  void openToMeet;
  void updatedAt;
  void matchPriority;
  const publicSpecResults = publicProfile.specShownPublicly
    ? specTestResults.map(({ specType, assumedAttractionTarget }) => ({
        specType,
        assumedAttractionTarget,
      }))
    : [];

  return {
    profile: { ...publicProfile, specTestResults: publicSpecResults },
    compatibilityScore,
    candidateUpdatedAt: candidate.updatedAt,
    // Spec first when it fires - it's the most personal signal available (an explicit
    // self-report, not an inference from behavior/location), so it's worth leading with.
    reasons: [...spec.reasons, ...proximity.reasons, ...availability.reasons, ...activity.reasons]
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
      return b.candidateUpdatedAt.getTime() - a.candidateUpdatedAt.getTime();
    })
    .slice(0, clampLimit(limit))
    .map(({ candidateUpdatedAt, ...recommendation }) => {
      void candidateUpdatedAt;
      return recommendation;
    });
}
