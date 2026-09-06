import { prisma } from "@/lib/prisma";
import { haversineDistanceKm } from "@/lib/home-feed";
import { affinityTerm } from "@/lib/recommendation-scoring";

export { affinityTerm };

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

/** Fraction of the VIEWER's own selected interests (lib/topics.ts) this candidate shares -
 * 0 when the viewer has picked no interests, the same graceful-degradation shape every other
 * term in the discovery/ranking plan uses for a signal-less viewer. */
export function sharedTopicsTerm(viewerTopicIds: Set<string>, candidateTopicIds: Set<string>): number {
  if (viewerTopicIds.size === 0) return 0;
  let shared = 0;
  for (const topicId of Array.from(candidateTopicIds)) {
    if (viewerTopicIds.has(topicId)) shared++;
  }
  return shared / viewerTopicIds.size;
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

/** Batch-fetches every candidate's selected interest topic ids in one query, grouped by
 * profile id - the counterpart to lib/topics.ts's getProfileTopicIds, which only fetches one
 * profile at a time. */
export async function getTopicIdsByProfile(profileIds: string[]): Promise<Map<string, Set<string>>> {
  const byProfile = new Map<string, Set<string>>();
  if (profileIds.length === 0) return byProfile;

  const rows = await prisma.profileTopic.findMany({
    where: { profileId: { in: profileIds } },
    select: { profileId: true, topicId: true },
  });
  for (const row of rows) {
    const set = byProfile.get(row.profileId) ?? new Set<string>();
    set.add(row.topicId);
    byProfile.set(row.profileId, set);
  }
  return byProfile;
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
  locationLat: number;
  locationLng: number;
  createdAt: Date;
  isTrustedMember: boolean;
  isVerified: boolean;
  isVerifiedCreator: boolean;
  isVerifiedServiceProvider: boolean;
};

const PEOPLE_WEIGHTS = {
  affinity: 0.35,
  sharedTopics: 0.25,
  locality: 0.15,
  trust: 0.15,
  novelty: 0.1,
};

/**
 * Ranks candidate profiles for a "people, not posts" discovery surface (Discover, the
 * creators directory) per the plan: affinity, shared topics, locality, trust, novelty. No
 * relationship/Follow term here on purpose, unlike the Live ring - these surfaces exist to
 * surface people the viewer *doesn't* already have a relationship with. Returns candidate
 * ids in ranked order; graceful degradation is structural for an anonymous or signal-less
 * viewer (affinity/sharedTopics/locality all fall to 0), never a special case.
 */
export async function rankRecommendedProfiles(
  viewer: { id: string; locationLat: number; locationLng: number } | null,
  candidates: RecommendableProfile[],
  now: Date = new Date(),
): Promise<string[]> {
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((candidate) => candidate.id);
  const [affinityByCreator, topicsByProfile, viewerTopicIds] = await Promise.all([
    viewer ? getAffinityByCreator(viewer.id, candidateIds) : Promise.resolve(new Map<string, number>()),
    getTopicIdsByProfile(candidateIds),
    viewer ? getTopicIdsByProfile([viewer.id]).then((map) => map.get(viewer.id) ?? new Set<string>()) : Promise.resolve(new Set<string>()),
  ]);

  return candidates
    .map((candidate) => {
      const score =
        PEOPLE_WEIGHTS.affinity * affinityTerm(affinityByCreator.get(candidate.id) ?? 0) +
        PEOPLE_WEIGHTS.sharedTopics * sharedTopicsTerm(viewerTopicIds, topicsByProfile.get(candidate.id) ?? new Set()) +
        PEOPLE_WEIGHTS.locality * localityTerm(viewer, candidate) +
        PEOPLE_WEIGHTS.trust * trustTerm(candidate) +
        PEOPLE_WEIGHTS.novelty * noveltyTerm(candidate.createdAt, now);
      return { id: candidate.id, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.id);
}

export type RecommendableCreator = Omit<RecommendableProfile, "locationLat" | "locationLng">;

const CREATOR_WEIGHTS = {
  affinity: 0.4,
  sharedTopics: 0.25,
  trust: 0.2,
  novelty: 0.15,
};

/**
 * Ranks creators for the creators directory: affinity, shared topics, trust, novelty - no
 * locality term, unlike rankRecommendedProfiles above. Subscribing is a global marketplace
 * decision, not a physical-proximity one, so distance has no place here; the weight it would
 * have carried is redistributed across the remaining four terms instead of left on the table.
 * Deliberately not merged into rankRecommendedProfiles behind a "skip locality" flag - the
 * weight formulas and term sets differ enough that a shared wrapper would need more
 * conditional plumbing than the duplication it would save.
 */
export async function rankRecommendedCreators(
  viewerId: string | null,
  candidates: RecommendableCreator[],
  now: Date = new Date(),
): Promise<string[]> {
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((candidate) => candidate.id);
  const [affinityByCreator, topicsByProfile, viewerTopicIds] = await Promise.all([
    viewerId ? getAffinityByCreator(viewerId, candidateIds) : Promise.resolve(new Map<string, number>()),
    getTopicIdsByProfile(candidateIds),
    viewerId ? getTopicIdsByProfile([viewerId]).then((map) => map.get(viewerId) ?? new Set<string>()) : Promise.resolve(new Set<string>()),
  ]);

  return candidates
    .map((candidate) => {
      const score =
        CREATOR_WEIGHTS.affinity * affinityTerm(affinityByCreator.get(candidate.id) ?? 0) +
        CREATOR_WEIGHTS.sharedTopics * sharedTopicsTerm(viewerTopicIds, topicsByProfile.get(candidate.id) ?? new Set()) +
        CREATOR_WEIGHTS.trust * trustTerm(candidate) +
        CREATOR_WEIGHTS.novelty * noveltyTerm(candidate.createdAt, now);
      return { id: candidate.id, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.id);
}
