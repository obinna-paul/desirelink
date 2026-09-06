import { prisma } from "@/lib/prisma";
import { getOrBuildSlate } from "@/lib/feed-slate";
import { scoreCandidates, type RankablePost } from "@/lib/recommendation-scoring";
import { assembleSlate, seededTiebreak, type SlateCandidate } from "@/lib/ranking/slate";

/** Env-presence flag, matching the isBunnyStreamConfigured() idiom (lib/bunny-stream.ts) -
 * ranking stays fully off, with zero behavior change, until this is explicitly set. */
export function isFeedRankingEnabled(): boolean {
  return process.env.FEED_RANKING_ENABLED === "true";
}

/** Share of viewers permanently excluded from ranking even when the flag is on, always
 * getting chronological order - the plan's holdout group, since at this traffic level no A/B
 * test would reach significance (see the plan's Metrics section). Reuses slate.ts's seeded
 * hash rather than inventing a second one, keyed separately from any per-request seed so a
 * viewer's holdout membership never changes. */
const HOLDOUT_PERCENT = 10;
const HOLDOUT_SEED = "feed-ranking-holdout";

export function isInRankingHoldout(viewerId: string): boolean {
  return seededTiebreak(HOLDOUT_SEED, viewerId) * 100 < HOLDOUT_PERCENT;
}

/**
 * Sessions aren't identified yet for the feed (no browsing-session cookie exists) - every
 * request from the same viewer within the same ~15-minute bucket shares this one constant
 * seed, so they all reuse a single frozen FeedSlate rather than each computing their own.
 * Revisit once real per-session identifiers exist and distinct sessions should be free to
 * see independently-ordered exploration slots.
 */
export const HOME_FEED_SESSION_SEED = "home-feed";

export type RankableFeedPost = {
  id: string;
  authorId: string;
  createdAt: Date;
  /** Whether this post is currently locked for this viewer (PostView.locked) - the ranking
   * engine never re-derives access itself, it trusts what's already been resolved. */
  locked: boolean;
};

/**
 * Re-orders an already-eligible, already-access-resolved set of feed posts using the Tier 2
 * four-term score (lib/recommendation-scoring.ts) and slate assembly (lib/ranking/slate.ts),
 * persisting the result via getOrBuildSlate so repeated requests within the same bucket see a
 * stable order. Returns ranked post ids; any post the slate couldn't place (creator caps,
 * the locked-without-affinity gate) is simply absent from the result - callers must not treat
 * this as the full candidate set, see applyFeedRanking in lib/posts.ts for how the caller
 * folds omitted posts back in rather than letting the feed silently shrink.
 *
 * Deliberate v1 simplification, disclosed: there is no separate exploration-pool candidate
 * source yet (that's a retrieval-stage concern, not built out here), so assembleSlate always
 * receives an empty exploration pool - its exploration quota falls back to the main pool for
 * every slot, meaning no structural exploration diversity yet.
 */
export async function rankFeedPosts(
  viewerId: string,
  sessionSeed: string,
  posts: RankableFeedPost[],
  now: Date = new Date(),
): Promise<string[]> {
  if (posts.length === 0) return [];

  const buildPostIds = async (): Promise<string[]> => {
    const postIds = posts.map((post) => post.id);
    const authorIds = Array.from(new Set(posts.map((post) => post.authorId)));

    const [affinities, qualities] = await Promise.all([
      prisma.creatorAffinity.findMany({
        where: { viewerId, creatorId: { in: authorIds } },
        select: { creatorId: true, affinity: true },
      }),
      prisma.postQuality.findMany({
        where: { postId: { in: postIds } },
        select: { postId: true, quality: true },
      }),
    ]);

    const affinityByCreator = new Map(affinities.map((row) => [row.creatorId, row.affinity]));
    const qualityByPost = new Map(qualities.map((row) => [row.postId, row.quality]));

    const rankable: RankablePost[] = posts.map((post) => ({
      id: post.id,
      authorId: post.authorId,
      rawAffinity: affinityByCreator.get(post.authorId) ?? 0,
      rawQuality: qualityByPost.get(post.id) ?? 0,
      publishedAt: post.createdAt,
      isLocked: post.locked,
    }));

    const scored = scoreCandidates(rankable, now);

    const slateCandidates: SlateCandidate[] = scored.map((post) => ({
      id: post.id,
      authorId: post.authorId,
      score: post.score,
      isLocked: post.isLocked,
      hasAffinity: post.affinity > 0,
    }));

    const assembled = assembleSlate({ ranked: slateCandidates, exploration: [] }, { seed: `${viewerId}:${sessionSeed}` });

    return assembled.map((candidate) => candidate.id);
  };

  const { postIds } = await getOrBuildSlate(viewerId, sessionSeed, buildPostIds, now);
  return postIds;
}
