import { prisma } from "@/lib/prisma";

/** Ranked order isn't a stable DB column - scores shift between requests - so a ranked feed
 * can't use the app's usual keyset cursor. Instead the ranked slate is frozen for this many
 * minutes and pagination becomes a plain offset read into it. See the discovery/ranking plan. */
const BUCKET_MINUTES = 15;

export function bucketStartFor(now: Date = new Date()): Date {
  const bucketMs = BUCKET_MINUTES * 60 * 1000;
  return new Date(Math.floor(now.getTime() / bucketMs) * bucketMs);
}

export type GetOrBuildSlateResult = { postIds: string[]; bucketStart: Date; reused: boolean };

/**
 * Returns the frozen slate for (viewer, sessionSeed, the current 15-minute bucket), building
 * one via buildPostIds() only if none exists yet for this bucket - buildPostIds should run
 * the full retrieval+scoring+assembly pipeline (lib/ranking/engine.ts, a later task), never
 * called on every page read, only once per bucket per (viewer, sessionSeed).
 */
export async function getOrBuildSlate(
  viewerId: string,
  sessionSeed: string,
  buildPostIds: () => Promise<string[]>,
  now: Date = new Date(),
): Promise<GetOrBuildSlateResult> {
  const bucketStart = bucketStartFor(now);
  const where = { viewerId_sessionSeed_bucketStart: { viewerId, sessionSeed, bucketStart } };

  const existing = await prisma.feedSlate.findUnique({ where, select: { postIds: true } });
  if (existing) {
    return { postIds: existing.postIds, bucketStart, reused: true };
  }

  const postIds = await buildPostIds();

  try {
    await prisma.feedSlate.create({ data: { viewerId, sessionSeed, bucketStart, postIds } });
  } catch (error) {
    // Another concurrent request for the same bucket won the race (P2002 on the unique
    // constraint) - read back what it wrote instead of erroring or duplicating a slate.
    if ((error as { code?: string })?.code === "P2002") {
      const winner = await prisma.feedSlate.findUnique({ where, select: { postIds: true } });
      if (winner) return { postIds: winner.postIds, bucketStart, reused: true };
    }
    throw error;
  }

  return { postIds, bucketStart, reused: false };
}

export type SlatePage = { postIds: string[]; hasMore: boolean; bucketStart: Date | null };

/**
 * Offset-based pagination reader into the CURRENT bucket's frozen slate - it does not fall
 * back to an older bucket. A page request past a session's ~15-minute window (once
 * getOrBuildSlate has moved on to building the next bucket's slate) simply sees no slate for
 * the new bucket yet, rather than silently continuing a stale one.
 */
export async function getSlatePage(
  viewerId: string,
  sessionSeed: string,
  offset: number,
  limit: number,
  now: Date = new Date(),
): Promise<SlatePage> {
  const bucketStart = bucketStartFor(now);
  const boundedOffset = Math.max(0, offset);

  const slate = await prisma.feedSlate.findUnique({
    where: { viewerId_sessionSeed_bucketStart: { viewerId, sessionSeed, bucketStart } },
    select: { postIds: true },
  });
  if (!slate) return { postIds: [], hasMore: false, bucketStart: null };

  const page = slate.postIds.slice(boundedOffset, boundedOffset + limit);
  return { postIds: page, hasMore: boundedOffset + page.length < slate.postIds.length, bucketStart };
}
