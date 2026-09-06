import { prisma } from "@/lib/prisma";

/** Bayesian smoothing pseudo-count - see the discovery/ranking plan's Tier 1 scoring. */
const SMOOTHING_M = 50;

/** Below this many trailing-3-day impressions, the recent rate is too noisy to trust -
 * fall back to the smoothed 30-day rate instead (velocityMultiplier defaults to 1). */
const MIN_RECENT_IMPRESSIONS = 5;

const VELOCITY_MIN = 0.5;
const VELOCITY_MAX = 2.0;

const WINDOW_DAYS = 30;
const RECENT_DAYS = 3;

function daysAgo(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

type StatsRow = { postId: string; impressions: number; weightedEngagement: number };

type PostAggregate = { impressions: number; weighted: number };

function aggregateByPost(rows: StatsRow[]): Map<string, PostAggregate> {
  const byPost = new Map<string, PostAggregate>();
  for (const row of rows) {
    const existing = byPost.get(row.postId) ?? { impressions: 0, weighted: 0 };
    existing.impressions += row.impressions;
    existing.weighted += row.weightedEngagement;
    byPost.set(row.postId, existing);
  }
  return byPost;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type RefreshPostQualitySummary = { postsUpdated: number; priorRate: number };

/**
 * Recomputes PostQuality for every post with any activity in the trailing 30 days, reading
 * only PostDailyStats (never raw PostImpression rows - see that model's rollup in
 * lib/post-daily-stats.ts). quality = smoothedEngagementRate * velocityMultiplier *
 * trustMultiplier; see the discovery/ranking plan for the formula's derivation.
 */
export async function refreshPostQuality(now: Date = new Date()): Promise<RefreshPostQualitySummary> {
  const windowStart = daysAgo(WINDOW_DAYS, now);
  const recentStart = daysAgo(RECENT_DAYS, now);

  const windowRows = await prisma.postDailyStats.findMany({
    where: { date: { gte: windowStart } },
    select: { postId: true, date: true, impressions: true, weightedEngagement: true, post: { select: { authorId: true } } },
  });

  const windowByPost = aggregateByPost(windowRows);
  const recentByPost = aggregateByPost(windowRows.filter((row) => row.date >= recentStart));

  const platformImpressions = windowRows.reduce((sum, row) => sum + row.impressions, 0);
  const platformWeighted = windowRows.reduce((sum, row) => sum + row.weightedEngagement, 0);
  const priorRate = platformImpressions > 0 ? platformWeighted / platformImpressions : 0;

  const authorByPost = new Map<string, string>();
  for (const row of windowRows) {
    authorByPost.set(row.postId, row.post.authorId);
  }

  const authorIds = Array.from(new Set(Array.from(authorByPost.values())));
  const profiles = await prisma.profile.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, communityStanding: true },
  });
  const standingByAuthor = new Map(profiles.map((profile) => [profile.id, profile.communityStanding]));

  const postIds = Array.from(windowByPost.keys());

  await Promise.all(
    postIds.map((postId) => {
      const window = windowByPost.get(postId)!;
      const smoothedEngagementRate = (window.weighted + SMOOTHING_M * priorRate) / (window.impressions + SMOOTHING_M);

      const recent = recentByPost.get(postId);
      let velocityMultiplier = 1;
      if (recent && recent.impressions >= MIN_RECENT_IMPRESSIONS) {
        const recentRate = (recent.weighted + SMOOTHING_M * priorRate) / (recent.impressions + SMOOTHING_M);
        const baseline = smoothedEngagementRate || priorRate || 0.0001;
        velocityMultiplier = clamp(recentRate / baseline, VELOCITY_MIN, VELOCITY_MAX);
      }

      const communityStanding = standingByAuthor.get(authorByPost.get(postId)!) ?? 0;
      const trustMultiplier = 0.85 + 0.15 * (communityStanding / 100);

      const quality = smoothedEngagementRate * velocityMultiplier * trustMultiplier;

      const data = {
        quality,
        smoothedEngagementRate,
        velocityMultiplier,
        trustMultiplier,
        impressions30d: window.impressions,
      };

      return prisma.postQuality.upsert({
        where: { postId },
        create: { postId, ...data },
        update: data,
      });
    }),
  );

  return { postsUpdated: postIds.length, priorRate };
}
