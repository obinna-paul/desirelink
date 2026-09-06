import { prisma } from "@/lib/prisma";

/** Weights mirror the discovery/ranking plan's Tier 1 positive-signal weights, limited to
 * the signals actually attributable to a specific post today (see PostDailyStats's doc
 * comment in schema.prisma for what's missing and why). */
const WEIGHT_UNLOCK = 6;
const WEIGHT_SHARE = 3;
const WEIGHT_SAVE = 3;
const WEIGHT_COMMENT = 2;
const WEIGHT_LIKE = 1;

/** Raw impression retention - see pruneOldPostImpressions. Rolled-up stats are kept
 * indefinitely; only the raw per-viewer rows get pruned. */
const IMPRESSION_RETENTION_DAYS = 45;

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

type CountRow = { postId: string; _count: { _all: number } };

function toCountMap(rows: CountRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.postId, row._count._all]));
}

export type RollupPostDailyStatsSummary = { date: string; postsUpdated: number };

/**
 * Rolls up one UTC day's engagement per post from raw event tables into PostDailyStats.
 * Defaults to yesterday (UTC) - meant to run once daily, well after that day has fully
 * elapsed everywhere. Ranking should read this table, never raw PostImpression rows.
 */
export async function rollupPostDailyStats(forDate: Date = new Date()): Promise<RollupPostDailyStatsSummary> {
  const dayStart = utcDayStart(new Date(forDate.getTime() - 24 * 60 * 60 * 1000));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const createdAt = { gte: dayStart, lt: dayEnd };

  const [impressions, likes, comments, shares, saves, unlocks] = await Promise.all([
    prisma.postImpression.groupBy({ by: ["postId"], where: { createdAt }, _count: { _all: true } }),
    prisma.postReaction.groupBy({ by: ["postId"], where: { createdAt, type: "like" }, _count: { _all: true } }),
    prisma.postComment.groupBy({ by: ["postId"], where: { createdAt }, _count: { _all: true } }),
    prisma.postShare.groupBy({ by: ["postId"], where: { createdAt }, _count: { _all: true } }),
    prisma.savedPost.groupBy({ by: ["postId"], where: { createdAt }, _count: { _all: true } }),
    prisma.postUnlock.groupBy({ by: ["postId"], where: { createdAt }, _count: { _all: true } }),
  ]);

  const impressionsByPost = toCountMap(impressions);
  const likesByPost = toCountMap(likes);
  const commentsByPost = toCountMap(comments);
  const sharesByPost = toCountMap(shares);
  const savesByPost = toCountMap(saves);
  const unlocksByPost = toCountMap(unlocks);

  const postIds = new Set([
    ...Array.from(impressionsByPost.keys()),
    ...Array.from(likesByPost.keys()),
    ...Array.from(commentsByPost.keys()),
    ...Array.from(sharesByPost.keys()),
    ...Array.from(savesByPost.keys()),
    ...Array.from(unlocksByPost.keys()),
  ]);

  await Promise.all(
    Array.from(postIds).map((postId) => {
      const likeCount = likesByPost.get(postId) ?? 0;
      const commentCount = commentsByPost.get(postId) ?? 0;
      const shareCount = sharesByPost.get(postId) ?? 0;
      const saveCount = savesByPost.get(postId) ?? 0;
      const unlockCount = unlocksByPost.get(postId) ?? 0;

      const data = {
        impressions: impressionsByPost.get(postId) ?? 0,
        likes: likeCount,
        comments: commentCount,
        shares: shareCount,
        saves: saveCount,
        unlocks: unlockCount,
        weightedEngagement:
          unlockCount * WEIGHT_UNLOCK +
          shareCount * WEIGHT_SHARE +
          saveCount * WEIGHT_SAVE +
          commentCount * WEIGHT_COMMENT +
          likeCount * WEIGHT_LIKE,
      };

      return prisma.postDailyStats.upsert({
        where: { postId_date: { postId, date: dayStart } },
        create: { postId, date: dayStart, ...data },
        update: data,
      });
    }),
  );

  return { date: dayStart.toISOString().slice(0, 10), postsUpdated: postIds.size };
}

export type PruneOldPostImpressionsSummary = { deleted: number; cutoff: string };

/** Deletes raw PostImpression rows past retention - their engagement is already durable in
 * PostDailyStats by the time they're this old, since the rollup above runs daily. */
export async function pruneOldPostImpressions(): Promise<PruneOldPostImpressionsSummary> {
  const cutoff = new Date(Date.now() - IMPRESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.postImpression.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { deleted: result.count, cutoff: cutoff.toISOString() };
}
