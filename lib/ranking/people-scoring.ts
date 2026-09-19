import type { ProfileType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineDistanceKm } from "@/lib/home-feed";
import { affinityTerm } from "@/lib/recommendation-scoring";
import { seededTiebreak } from "@/lib/ranking/slate";
import { bucketStartFor } from "@/lib/feed-slate";
import { typeTerm } from "@/lib/ranking/type-priority";
import { scoreReciprocalSpecCompatibility, type SpecVectorResult } from "@/lib/spec-test/vector-compatibility";
import { normalizeMatchPriority, type MatchPriorityValue } from "@/lib/match-priority";

export { affinityTerm, typeTerm };

/** [0, 1] already. Scores both directions using each person's own priority; full vectors
 * are used when both sides have them and older rows fall back to archetype compatibility. */
type RankedSpecResult = SpecVectorResult;

export function specTerm(
  viewerSpec: RankedSpecResult[],
  candidateSpec: RankedSpecResult[],
  viewerPriority: MatchPriorityValue = "BALANCED",
  candidatePriority: MatchPriorityValue = "BALANCED",
): number {
  return scoreReciprocalSpecCompatibility(
    viewerSpec,
    candidateSpec,
    viewerPriority,
    candidatePriority,
  ).score;
}

const TONIGHT_STATUSES = new Set(["available_tonight", "out_tonight"]);

export function availabilityTerm(
  viewerStatuses: { status: string }[] | undefined,
  candidateStatuses: { status: string }[] | undefined,
): number {
  const viewerStatus = viewerStatuses?.[0]?.status;
  if (!viewerStatus || !TONIGHT_STATUSES.has(viewerStatus)) return 0;

  const candidateStatus = candidateStatuses?.[0]?.status;
  if (!candidateStatus) return 0;
  if (TONIGHT_STATUSES.has(candidateStatus)) return 1;
  if (candidateStatus === "open_to_meeting" || candidateStatus === "couple_looking") return 0.65;
  if (candidateStatus === "chatting_only") return 0.35;
  return 0;
}

/** Same distance buckets as lib/recommendations.ts's scoreProximity and
 * lib/live-streams.ts's own locality term, normalized to [0, 1] here so it combines cleanly
 * with the other weighted terms below. Not extracted further than this - live-streams.ts's
 * copy predates this module and isn't worth touching already-shipped, tested code for. */
export function localityTerm(
  viewer: { locationLat: number; locationLng: number } | null,
  candidate: { locationLat: number; locationLng: number },
): number {
  if (!viewer) return 0;
  const viewerHasLocation = viewer.locationLat !== 0 || viewer.locationLng !== 0;
  const candidateHasLocation = candidate.locationLat !== 0 || candidate.locationLng !== 0;
  if (!viewerHasLocation || !candidateHasLocation) return 0;

  const distanceKm = haversineDistanceKm(viewer.locationLat, viewer.locationLng, candidate.locationLat, candidate.locationLng);
  if (distanceKm <= 10) return 1;
  if (distanceKm <= 25) return 0.75;
  if (distanceKm <= 50) return 0.5;
  if (distanceKm <= 100) return 0.25;
  if (distanceKm <= 250) return 0.1;
  return 0;
}

/** Reuses the trust signals Discover's own "verified"/"trusted" filters already use
 * (lib/discover.ts's buildWhere) rather than fetching Profile.communityStanding directly -
 * no new field needed on the already-widely-shared profileCardSelect. */
export function trustTerm(profile: { isTrustedMember: boolean; isVerified: boolean; isVerifiedCreator: boolean; isVerifiedServiceProvider: boolean }): number {
  if (profile.isTrustedMember) return 1;
  if (profile.isVerified || profile.isVerifiedCreator || profile.isVerifiedServiceProvider) return 0.5;
  return 0;
}

/** An account's novelty decays over a month, not recommendation-scoring.ts's 36-hour
 * post-recency half-life - an account is "novel" on a much longer timescale than a post is
 * "fresh". */
const NOVELTY_HALF_LIFE_DAYS = 30;
export function noveltyTerm(createdAt: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return Math.pow(0.5, ageDays / NOVELTY_HALF_LIFE_DAYS);
}

export async function getAffinityByCreator(viewerId: string, creatorIds: string[]): Promise<Map<string, number>> {
  const byCreator = new Map<string, number>();
  if (creatorIds.length === 0) return byCreator;

  const rows = await prisma.creatorAffinity.findMany({
    where: { viewerId, creatorId: { in: creatorIds } },
    select: { creatorId: true, affinity: true },
  });
  for (const row of rows) {
    byCreator.set(row.creatorId, row.affinity);
  }
  return byCreator;
}

export type RecommendableProfile = {
  id: string;
  profileType: ProfileType;
  locationLat: number;
  locationLng: number;
  createdAt: Date;
  isTrustedMember: boolean;
  isVerified: boolean;
  isVerifiedCreator: boolean;
  isVerifiedServiceProvider: boolean;
  matchPriority?: MatchPriorityValue;
  // Optional, not required: rankRecommendedCreators below never reads this (creators
  // directory candidates aren't built from profileCardSelect()), so it shouldn't have to
  // supply a field it has no use for. rankRecommendedProfiles (Discover) always has it.
  availabilityStatuses?: { status: string; expiresAt?: Date }[];
  specTestResults?: RankedSpecResult[];
};

/** Reweighted to make room for the type term below, then again for spec below that. Affinity
 * still leads since behavioral affinity is the strongest available personalization signal;
 * type is the second-strongest since (unlike locality/trust/novelty) it's read directly off
 * the viewer, not just the candidate, so it varies the order between viewers even before any
 * interaction history exists. Spec starts small since matching outcomes are not yet
 * validated - it contributes 0 for the common case where either side hasn't taken the test,
 * same as every other term when its input is absent. */
const PEOPLE_WEIGHTS = {
  BALANCED: { affinity: 0.35, type: 0.15, locality: 0.15, trust: 0.15, novelty: 0.1, spec: 0.1, availability: 0 },
  SPARK: { affinity: 0.35, type: 0.1, locality: 0.1, trust: 0.1, novelty: 0.1, spec: 0.25, availability: 0 },
  PARTNERSHIP: { affinity: 0.25, type: 0.1, locality: 0.1, trust: 0.25, novelty: 0.05, spec: 0.25, availability: 0 },
  TONIGHT: { affinity: 0.2, type: 0.1, locality: 0.25, trust: 0.15, novelty: 0.05, spec: 0.1, availability: 0.15 },
} as const;

/** Score values are continuous, so exact ties are rare - quantizing into steps this wide
 * groups "close enough" candidates into the same rank tier so they still shuffle together
 * (see the seeded tiebreak below), rather than only ever shuffling literal floating-point
 * ties. */
const SCORE_TIER_STEP = 0.05;

/**
 * Orders candidates by score into discrete tiers, then shuffles within each tier using a
 * hash seeded from (seed, id) - stable for a given seed (so it doesn't reshuffle on every
 * request) but different per seed. Ranking still dominates: shuffling only ever reorders
 * candidates the score already considered equivalent, never crosses a tier boundary.
 */
function rankWithSeededShuffle(scored: { id: string; score: number }[], seed: string): string[] {
  return scored
    .slice()
    .sort((a, b) => {
      const tierDiff = Math.round(b.score / SCORE_TIER_STEP) - Math.round(a.score / SCORE_TIER_STEP);
      if (tierDiff !== 0) return tierDiff;
      return seededTiebreak(seed, a.id) - seededTiebreak(seed, b.id);
    })
    .map((entry) => entry.id);
}

/**
 * Ranks candidate profiles for a "people, not posts" discovery surface (Discover): affinity,
 * profile type, locality, trust, novelty - all either behavioral or read directly off the
 * viewer, never self-reported interests. Returns candidate ids in ranked order.
 *
 * Two viewers with zero interaction history and no location set still see different orders,
 * not identical ones: type already varies by the viewer's own profileType, and same-tier
 * candidates (typically everyone tied on type+trust+novelty for a signal-less viewer) are
 * shuffled via a hash seeded on (viewer, this 15-minute bucket) - stable for that viewer for
 * that window (so a page reload doesn't reshuffle mid-browse), refreshed automatically every
 * ~15 minutes rather than staying frozen on the same order forever, and different for every
 * other viewer.
 */
export async function rankRecommendedProfiles(
  viewer:
    | {
        id: string;
        profileType: ProfileType | null;
        locationLat: number;
        locationLng: number;
        matchPriority?: MatchPriorityValue;
        availabilityStatuses?: { status: string; expiresAt?: Date }[];
        specTestResults: RankedSpecResult[];
      }
    | null,
  candidates: RecommendableProfile[],
  now: Date = new Date(),
): Promise<string[]> {
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((candidate) => candidate.id);
  const affinityByCreator = viewer
    ? await getAffinityByCreator(viewer.id, candidateIds)
    : new Map<string, number>();
  const priority = normalizeMatchPriority(viewer?.matchPriority);
  const tonight = Boolean(viewer?.availabilityStatuses?.[0]?.status && TONIGHT_STATUSES.has(viewer.availabilityStatuses[0].status));
  const weights = tonight ? PEOPLE_WEIGHTS.TONIGHT : PEOPLE_WEIGHTS[priority];
  const seed = `discover:${viewer?.id ?? "anon"}:${priority}:${tonight ? "tonight" : "standard"}:${bucketStartFor(now).getTime()}`;

  const scored = candidates.map((candidate) => {
    const score =
      weights.affinity * affinityTerm(affinityByCreator.get(candidate.id) ?? 0) +
      weights.type * typeTerm(viewer?.profileType ?? null, candidate.profileType) +
      weights.locality * localityTerm(viewer, candidate) +
      weights.trust * trustTerm(candidate) +
      weights.novelty * noveltyTerm(candidate.createdAt, now) +
      weights.spec * specTerm(
        viewer?.specTestResults ?? [],
        candidate.specTestResults ?? [],
        priority,
        normalizeMatchPriority(candidate.matchPriority),
      ) +
      weights.availability * availabilityTerm(viewer?.availabilityStatuses, candidate.availabilityStatuses);
    return { id: candidate.id, score };
  });

  return rankWithSeededShuffle(scored, seed);
}

// Not Omit<RecommendableProfile, ...> - the creator-directory formula below never reads
// profileType (only Discover's rankRecommendedProfiles does), so it shouldn't force every
// caller of rankRecommendedCreators to fetch and supply it too.
export type RecommendableCreator = Omit<RecommendableProfile, "locationLat" | "locationLng" | "profileType">;

/** Same reweighting rationale as PEOPLE_WEIGHTS above, applied to the (already
 * locality-free) creator-directory formula. */
const CREATOR_WEIGHTS = {
  affinity: 0.55,
  trust: 0.25,
  novelty: 0.2,
};

/**
 * Ranks creators for the creators directory: affinity, trust, novelty - no locality term,
 * unlike rankRecommendedProfiles above. Subscribing is a global marketplace decision, not a
 * physical-proximity one, so distance has no place here.
 */
export async function rankRecommendedCreators(
  viewerId: string | null,
  candidates: RecommendableCreator[],
  now: Date = new Date(),
): Promise<string[]> {
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((candidate) => candidate.id);
  const affinityByCreator = viewerId
    ? await getAffinityByCreator(viewerId, candidateIds)
    : new Map<string, number>();

  return candidates
    .map((candidate) => {
      const score =
        CREATOR_WEIGHTS.affinity * affinityTerm(affinityByCreator.get(candidate.id) ?? 0) +
        CREATOR_WEIGHTS.trust * trustTerm(candidate) +
        CREATOR_WEIGHTS.novelty * noveltyTerm(candidate.createdAt, now);
      return { id: candidate.id, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.id);
}
