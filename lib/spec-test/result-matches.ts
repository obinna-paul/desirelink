import "server-only";

import type { AvailabilityStatusType, Prisma } from "@prisma/client";

import { haversineDistanceKm } from "@/lib/home-feed";
import type { MatchPriorityValue } from "@/lib/match-priority";
import { prisma } from "@/lib/prisma";
import {
  readLensVector,
  readScoringVector,
  scoreReciprocalSpecCompatibility,
  type SpecVectorResult,
} from "@/lib/spec-test/vector-compatibility";

const CANDIDATE_LIMIT = 1000;
const MINIMUM_RECIPROCAL_SCORE = 0.5;
const PREVIEW_LIMIT = 3;

export type ResultMatchViewer = {
  resultId: string;
  profileId: string | null;
  locationLat: number | null;
  locationLng: number | null;
  priority: MatchPriorityValue;
  specResult: SpecVectorResult;
};

export type ResultMatchPreview = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bannerUrl: string;
  city: string;
  country: string;
  showExactLocation: boolean;
  isVerified: boolean;
  isVerifiedCreator: boolean;
  distanceKm: number | null;
  explanation: string;
};

export type ResultMatchShortlist = {
  count: number;
  profiles: ResultMatchPreview[];
};

type Candidate = Prisma.ProfileGetPayload<{
  select: ReturnType<typeof resultMatchCandidateSelect>;
}>;

function resultMatchCandidateSelect() {
  return {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    bannerUrl: true,
    city: true,
    country: true,
    showExactLocation: true,
    isVerified: true,
    isVerifiedCreator: true,
    locationLat: true,
    locationLng: true,
    matchPriority: true,
    availabilityStatuses: {
      where: { expiresAt: { gt: new Date() } },
      select: { status: true },
      orderBy: { createdAt: "desc" as const },
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
      orderBy: { createdAt: "desc" as const },
      take: 1,
    },
  } satisfies Prisma.ProfileSelect;
}

function hasCoordinates(lat: number | null, lng: number | null): lat is number {
  return typeof lat === "number" && typeof lng === "number" && (lat !== 0 || lng !== 0);
}

function distanceFromViewer(viewer: ResultMatchViewer, candidate: Candidate): number | null {
  if (
    !hasCoordinates(viewer.locationLat, viewer.locationLng) ||
    !hasCoordinates(candidate.locationLat, candidate.locationLng)
  ) {
    return null;
  }
  return haversineDistanceKm(
    viewer.locationLat,
    viewer.locationLng!,
    candidate.locationLat,
    candidate.locationLng,
  );
}

function close(left: number, right: number, tolerance = 18): boolean {
  return Math.abs(left - right) <= tolerance;
}

/** Public copy is intentionally about shared preferences, never a claim that the candidate
 * personally embodies a trait measured only as something they are attracted to. */
export function explainResultMatch(
  viewerResult: SpecVectorResult,
  candidateResult: SpecVectorResult,
  priority: MatchPriorityValue,
  reciprocalScore: number,
  distanceKm: number | null,
  availabilityStatus: AvailabilityStatusType | null,
): string {
  const viewerDimensions = readScoringVector(viewerResult);
  const candidateDimensions = readScoringVector(candidateResult);
  const viewerLenses = readLensVector(viewerResult);
  const candidateLenses = readLensVector(candidateResult);
  const availableNow = availabilityStatus !== null;
  const nearby = distanceKm !== null && distanceKm <= 50;

  if (priority === "SPARK" && reciprocalScore >= 0.7 && availableNow && nearby) {
    return "Strong Spark alignment and currently available nearby.";
  }

  if (
    priority === "PARTNERSHIP" &&
    viewerDimensions &&
    candidateDimensions &&
    viewerDimensions.warmthResponsiveness >= 60 &&
    candidateDimensions.warmthResponsiveness >= 60 &&
    viewerDimensions.reliabilityReciprocity >= 60 &&
    candidateDimensions.reliabilityReciprocity >= 60
  ) {
    return "You both value emotional steadiness.";
  }

  if (
    priority === "PARTNERSHIP" &&
    viewerLenses &&
    candidateLenses &&
    viewerLenses.explorationCommitment <= 45 &&
    candidateLenses.explorationCommitment <= 45
  ) {
    return "You both lean toward consistency and commitment.";
  }

  if (
    priority === "SPARK" &&
    viewerDimensions &&
    candidateDimensions &&
    viewerDimensions.socialVitality >= 60 &&
    candidateDimensions.socialVitality >= 60 &&
    viewerDimensions.noveltyAutonomy >= 60 &&
    candidateDimensions.noveltyAutonomy >= 60
  ) {
    return "You both light up around bold energy and spontaneity.";
  }

  if (
    viewerDimensions &&
    candidateDimensions &&
    viewerDimensions.cognitivePlay >= 60 &&
    candidateDimensions.cognitivePlay >= 60
  ) {
    return "You both value wit and mental chemistry.";
  }

  if (
    viewerLenses &&
    candidateLenses &&
    close(viewerLenses.directnessIntrigue, candidateLenses.directnessIntrigue)
  ) {
    return "You prefer a similar communication rhythm.";
  }

  if (availableNow && nearby) {
    return "Strong mutual fit and currently available nearby.";
  }

  if (
    viewerLenses &&
    candidateLenses &&
    close(viewerLenses.closenessAutonomy, candidateLenses.closenessAutonomy)
  ) {
    return "Your preferred balance of closeness and space aligns.";
  }

  return "Your Spec preferences align both ways.";
}

function localityBoost(distanceKm: number | null): number {
  if (distanceKm === null) return 0;
  if (distanceKm <= 10) return 1;
  if (distanceKm <= 25) return 0.75;
  if (distanceKm <= 50) return 0.5;
  if (distanceKm <= 100) return 0.25;
  return 0;
}

/**
 * Finds a read-only result-page shortlist. Eligibility is based on a meaningful reciprocal
 * Spec score; availability and distance only order eligible profiles and can never turn an
 * otherwise weak psychological fit into a displayed "match."
 */
export async function getResultMatchShortlist(viewer: ResultMatchViewer): Promise<ResultMatchShortlist> {
  let excludedProfileId = viewer.profileId;
  if (!excludedProfileId) {
    try {
      const sourceResult = await prisma.specTestResult.findUnique({
        where: { id: viewer.resultId },
        select: { profileId: true },
      });
      excludedProfileId = sourceResult?.profileId ?? null;
    } catch (error) {
      console.error("[spec-test] unable to resolve result owner for match shortlist", error);
      return { count: 0, profiles: [] };
    }
  }

  const where: Prisma.ProfileWhereInput = {
    isIncognito: false,
    showInSearch: true,
    isSuspended: false,
    specTestResults: { some: {} },
  };

  if (excludedProfileId) {
    where.NOT = { id: excludedProfileId };
    where.blocksReceived = { none: { blockerId: excludedProfileId } };
    where.blocksMade = { none: { blockedId: excludedProfileId } };
  }

  let candidates: Candidate[];
  try {
    candidates = await prisma.profile.findMany({
      where,
      select: resultMatchCandidateSelect(),
      orderBy: { updatedAt: "desc" },
      take: CANDIDATE_LIMIT,
    });
  } catch (error) {
    // Match discovery is an enhancement to an already-computed result. A temporary query
    // failure must preserve the original ending rather than make the result itself fail.
    console.error("[spec-test] unable to build result match shortlist", error);
    return { count: 0, profiles: [] };
  }

  const matches = candidates.flatMap((candidate) => {
    const candidateResult = candidate.specTestResults[0];
    if (!candidateResult) return [];

    const compatibility = scoreReciprocalSpecCompatibility(
      [viewer.specResult],
      [candidateResult],
      viewer.priority,
      candidate.matchPriority,
    );
    if (compatibility.score < MINIMUM_RECIPROCAL_SCORE) return [];

    const distanceKm = distanceFromViewer(viewer, candidate);
    const status = candidate.availabilityStatuses[0]?.status ?? null;
    const rankingScore =
      compatibility.score * 0.8 +
      localityBoost(distanceKm) * 0.1 +
      (status ? 0.1 : 0);

    return [{
      rankingScore,
      profile: {
        id: candidate.id,
        username: candidate.username,
        displayName: candidate.displayName,
        avatarUrl: candidate.avatarUrl,
        bannerUrl: candidate.bannerUrl,
        city: candidate.city,
        country: candidate.country,
        showExactLocation: candidate.showExactLocation,
        isVerified: candidate.isVerified,
        isVerifiedCreator: candidate.isVerifiedCreator,
        distanceKm,
        explanation: explainResultMatch(
          viewer.specResult,
          candidateResult,
          viewer.priority,
          compatibility.score,
          distanceKm,
          status,
        ),
      } satisfies ResultMatchPreview,
    }];
  });

  matches.sort((left, right) => right.rankingScore - left.rankingScore || left.profile.id.localeCompare(right.profile.id));

  return {
    count: matches.length,
    profiles: matches.slice(0, PREVIEW_LIMIT).map((match) => match.profile),
  };
}
