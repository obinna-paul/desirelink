import { prisma } from "@/lib/prisma";
import { getOrBuildSlate } from "@/lib/feed-slate";
import { getViewerHashtagAffinity, postHashtagAffinity } from "@/lib/hashtag-affinity";
import { scoreCandidates, type RankablePost } from "@/lib/recommendation-scoring";
import { assembleSlate, seededTiebreak, type SlateCandidate } from "@/lib/ranking/slate";

/** Ranking is the normal feed behavior. Keep an explicit false/0 kill switch for emergency
 * rollback; the caller already falls back to chronology if ranking storage is unavailable. */
export function isFeedRankingEnabled(): boolean {
  const value = process.env.FEED_RANKING_ENABLED?.trim().toLowerCase();
  return value !== "false" && value !== "0";
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

const MAX_SLATE_LENGTH = 100;

/** Exploration favors strong or fresh posts from creators the viewer has no positive
 * history with. It is intentionally behavior-only: no follows or declared preferences. */
function buildExplorationPool(scored: ReturnType<typeof scoreCandidates>): SlateCandidate[] {
  return scored
    .filter((post) => post.affinity <= 0 && !post.isLocked)
    .map((post) => ({
      id: post.id,
      authorId: post.authorId,
      score: post.quality * 0.7 + post.recency * 0.3,
      isLocked: false,
      hasAffinity: false,
    }));
}

/**
 * Re-orders an already-eligible, already-access-resolved set of feed posts using the Tier 2
 * four-term score (lib/recommendation-scoring.ts) and slate assembly (lib/ranking/slate.ts),
 * persisting the result via getOrBuildSlate so repeated requests within the same bucket see a
 * stable order. Returns ranked post ids; any post the slate couldn't place (creator caps,
 * the locked-without-affinity gate) is simply absent from the result - callers must not treat
 * this as the full candidate set, see applyFeedRanking in lib/posts.ts for how the caller
 * folds omitted posts back in rather than letting the feed silently shrink.
 *
 * The exploration pool is derived from fresh or high-quality unlocked posts by creators the
 * viewer has no positive behavioral history with. This gives unfamiliar creators reserved
 * opportunities without relying on follows or self-declared preferences.
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

    const [affinities, qualities, postHashtags, hashtagAffinity] = await Promise.all([
      prisma.creatorAffinity.findMany({
        where: { viewerId, creatorId: { in: authorIds } },
        select: { creatorId: true, affinity: true },
      }),
      prisma.postQuality.findMany({
        where: { postId: { in: postIds } },
        select: { postId: true, quality: true },
      }),
      prisma.postHashtag.findMany({
        where: { postId: { in: postIds } },
        select: { postId: true, hashtag: { select: { tag: true } } },
      }),
      getViewerHashtagAffinity(viewerId, now),
    ]);

    const affinityByCreator = new Map(affinities.map((row) => [row.creatorId, row.affinity]));
    const qualityByPost = new Map(qualities.map((row) => [row.postId, row.quality]));
    const hashtagsByPost = new Map<string, string[]>();
    for (const row of postHashtags) {
      const tags = hashtagsByPost.get(row.postId) ?? [];
      tags.push(row.hashtag.tag);
      hashtagsByPost.set(row.postId, tags);
    }

    const rankable: RankablePost[] = posts.map((post) => ({
      id: post.id,
      authorId: post.authorId,
      rawAffinity: affinityByCreator.get(post.authorId) ?? 0,
      rawTopicAffinity: postHashtagAffinity(
        hashtagsByPost.get(post.id) ?? [],
        hashtagAffinity,
      ),
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

    const exploration = buildExplorationPool(scored);
    const assembled = assembleSlate(
      { ranked: slateCandidates, exploration },
      {
        seed: `${viewerId}:${sessionSeed}`,
        targetLength: Math.min(MAX_SLATE_LENGTH, posts.length),
      },
    );

    return assembled.map((candidate) => candidate.id);
  };

  const { postIds } = await getOrBuildSlate(viewerId, sessionSeed, buildPostIds, now);
  return postIds;
}
