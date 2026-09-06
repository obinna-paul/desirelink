/**
 * Tier 2 of the discovery/ranking plan's scoring: pure, in-memory, request-time functions
 * over precomputed inputs (creator affinity, hashtag affinity, and post quality). No Prisma import
 * on purpose - retrieval (lib/ranking/engine.ts, added later) fetches the bounded candidate
 * set and the viewer's affinity map once, this module only ranks what it's handed.
 *
 * Hashtags now provide the topic term from recent behavior, without asking the viewer to
 * maintain a preference profile. Tag stuffing is neutralized when signals are recorded.
 */

export const SCORE_WEIGHTS = {
  affinity: 0.35,
  topic: 0.2,
  quality: 0.3,
  recency: 0.15,
} as const;

/** Raw CreatorAffinity.affinity units at which the affinity term reaches 0.5 - e.g. a lone
 * unlock (worth 6 raw units, see lib/creator-affinity.ts) alone only reaches ~0.23. */
const AFFINITY_SATURATION = 20;

/** Raw topic units at which the hashtag term reaches 0.5. */
const TOPIC_AFFINITY_SATURATION = 8;

/** Raw PostQuality.quality units at which the quality term reaches 0.5. */
const QUALITY_SATURATION = 1;

/** Recency half-life per the plan: a post this many hours old contributes half as much. */
const RECENCY_HALF_LIFE_HOURS = 36;

/** Applied to locked posts, scaled down by how much affinity the viewer already has for that
 * creator - a locked post from a creator the viewer already engages with isn't penalized much
 * (they may well convert), but locked content from a total stranger is pushed down hard. This
 * is the scoring-side complement to slate assembly's hard "locked quota" cap (lib/ranking/
 * slate.ts, added later) - "already seen recently" is handled upstream of scoring entirely,
 * as an eligibility-stage SQL filter on the candidate query, not a score penalty. */
const LOCKED_WITHOUT_AFFINITY_PENALTY = 0.15;

function saturateSigned(value: number, halfPoint: number): number {
  if (value === 0) return 0;
  const magnitude = Math.abs(value) / (Math.abs(value) + halfPoint);
  return Math.sign(value) * magnitude;
}

/** 0 when the viewer has no CreatorAffinity row for this creator - the graceful-degradation
 * case the plan requires: a new viewer's score collapses cleanly to quality + recency. */
export function affinityTerm(rawAffinity: number): number {
  return saturateSigned(rawAffinity, AFFINITY_SATURATION);
}

export function topicAffinityTerm(rawAffinity: number): number {
  return saturateSigned(rawAffinity, TOPIC_AFFINITY_SATURATION);
}

/** 0 when the post has no PostQuality row yet (e.g. brand new, cron hasn't run). */
export function qualityTerm(rawQuality: number): number {
  return Math.max(0, saturateSigned(rawQuality, QUALITY_SATURATION));
}

export function recencyTerm(publishedAt: Date, now: Date = new Date()): number {
  const ageHours = Math.max(0, (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60));
  return Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);
}

export type RankablePost = {
  id: string;
  authorId: string;
  /** CreatorAffinity.affinity for (viewer, this post's author); 0 if no row exists. */
  rawAffinity: number;
  /** Behavioral affinity toward this post's hashtags; 0 when it has no relevant tags. */
  rawTopicAffinity: number;
  /** PostQuality.quality for this post; 0 if no row exists yet. */
  rawQuality: number;
  publishedAt: Date;
  isLocked: boolean;
};

export type ScoreBreakdown = {
  score: number;
  affinity: number;
  topic: number;
  quality: number;
  recency: number;
  penalty: number;
};

/** Scores one candidate post for one viewer. Pure - every input the plan's affinity/quality/
 * recency/penalty terms need is passed in, nothing is fetched here. */
export function scorePost(input: RankablePost, now: Date = new Date()): ScoreBreakdown {
  const affinity = affinityTerm(input.rawAffinity);
  const topic = topicAffinityTerm(input.rawTopicAffinity);
  const quality = qualityTerm(input.rawQuality);
  const recency = recencyTerm(input.publishedAt, now);
  const penalty = input.isLocked ? LOCKED_WITHOUT_AFFINITY_PENALTY * (1 - affinity) : 0;

  const score =
    SCORE_WEIGHTS.affinity * affinity +
    SCORE_WEIGHTS.topic * topic +
    SCORE_WEIGHTS.quality * quality +
    SCORE_WEIGHTS.recency * recency -
    penalty;

  return { score, affinity, topic, quality, recency, penalty };
}

export type ScoredPost = RankablePost & ScoreBreakdown;

/** Scores every candidate and sorts descending by score, with a deterministic tiebreak on
 * publishedAt (newest first) - mirrors the tiebreak-on-updatedAt convention already
 * established in lib/recommendations.ts's getPersonalizedRecommendations. */
export function scoreCandidates(posts: RankablePost[], now: Date = new Date()): ScoredPost[] {
  return posts
    .map((post) => ({ ...post, ...scorePost(post, now) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.publishedAt.getTime() - a.publishedAt.getTime();
    });
}
