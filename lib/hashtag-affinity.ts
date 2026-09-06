import { prisma } from "@/lib/prisma";
import { normalizeHashtag } from "@/lib/hashtags";

const LOOKBACK_DAYS = 45;
const HALF_LIFE_DAYS = 14;
const MAX_SIGNALS_PER_KIND = 500;

const SIGNAL_WEIGHTS = {
  like: 1,
  comment: 2,
  share: 3,
  save: 3,
  unlock: 6,
  interested: 3,
  notInterested: -5,
  hashtagOpen: 1.5,
} as const;

type TaggedPost = { hashtags: Array<{ hashtag: { tag: string } }> };

function decayWeight(createdAt: Date, now: Date): number {
  const ageDays = Math.max(
    0,
    (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

function addTagSignal(
  affinityByTag: Map<string, number>,
  tag: string,
  amount: number,
): void {
  const normalized = normalizeHashtag(tag);
  if (!normalized) return;
  affinityByTag.set(normalized, (affinityByTag.get(normalized) ?? 0) + amount);
}

function addPostSignal(
  affinityByTag: Map<string, number>,
  post: TaggedPost,
  amount: number,
): void {
  const tags = post.hashtags.map((row) => row.hashtag.tag);
  if (tags.length === 0) return;

  // Divide one action across its tags so adding ten hashtags cannot create ten times the signal.
  const amountPerTag = amount / tags.length;
  for (const tag of tags) addTagSignal(affinityByTag, tag, amountPerTag);
}

const taggedPostSelect = {
  hashtags: { select: { hashtag: { select: { tag: true } } } },
} as const;

/**
 * Builds a viewer's topic affinity from actions they have actually taken. It asks for no
 * declared preferences and stores no new profile field. The feed slate caches the result,
 * so these bounded reads run at most once per slate window rather than on every render.
 */
export async function getViewerHashtagAffinity(
  viewerId: string,
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const recent = { gte: since };
  const latest = { createdAt: "desc" as const };

  const [likes, comments, shares, saves, unlocks, feedback, hashtagOpens] =
    await Promise.all([
      prisma.postReaction.findMany({
        where: { userId: viewerId, type: "like", createdAt: recent },
        orderBy: latest,
        take: MAX_SIGNALS_PER_KIND,
        select: { createdAt: true, post: { select: taggedPostSelect } },
      }),
      prisma.postComment.findMany({
        where: { authorId: viewerId, createdAt: recent },
        orderBy: latest,
        take: MAX_SIGNALS_PER_KIND,
        select: { createdAt: true, post: { select: taggedPostSelect } },
      }),
      prisma.postShare.findMany({
        where: { userId: viewerId, createdAt: recent },
        orderBy: latest,
        take: MAX_SIGNALS_PER_KIND,
        select: { createdAt: true, post: { select: taggedPostSelect } },
      }),
      prisma.savedPost.findMany({
        where: { viewerId, createdAt: recent },
        orderBy: latest,
        take: MAX_SIGNALS_PER_KIND,
        select: { createdAt: true, post: { select: taggedPostSelect } },
      }),
      prisma.postUnlock.findMany({
        where: { subscriberId: viewerId, createdAt: recent },
        orderBy: latest,
        take: MAX_SIGNALS_PER_KIND,
        select: { createdAt: true, post: { select: taggedPostSelect } },
      }),
      prisma.postFeedback.findMany({
        where: { viewerId, createdAt: recent },
        orderBy: latest,
        take: MAX_SIGNALS_PER_KIND,
        select: { kind: true, createdAt: true, post: { select: taggedPostSelect } },
      }),
      prisma.searchInteraction.findMany({
        where: { viewerId, createdAt: recent, query: { startsWith: "#" } },
        orderBy: latest,
        take: 100,
        select: { query: true, createdAt: true },
      }),
    ]);

  const affinityByTag = new Map<string, number>();
  for (const row of likes) {
    addPostSignal(
      affinityByTag,
      row.post,
      SIGNAL_WEIGHTS.like * decayWeight(row.createdAt, now),
    );
  }
  for (const row of comments) {
    addPostSignal(
      affinityByTag,
      row.post,
      SIGNAL_WEIGHTS.comment * decayWeight(row.createdAt, now),
    );
  }
  for (const row of shares) {
    addPostSignal(
      affinityByTag,
      row.post,
      SIGNAL_WEIGHTS.share * decayWeight(row.createdAt, now),
    );
  }
  for (const row of saves) {
    addPostSignal(
      affinityByTag,
      row.post,
      SIGNAL_WEIGHTS.save * decayWeight(row.createdAt, now),
    );
  }
  for (const row of unlocks) {
    addPostSignal(
      affinityByTag,
      row.post,
      SIGNAL_WEIGHTS.unlock * decayWeight(row.createdAt, now),
    );
  }
  for (const row of feedback) {
    const weight =
      row.kind === "interested"
        ? SIGNAL_WEIGHTS.interested
        : SIGNAL_WEIGHTS.notInterested;
    addPostSignal(affinityByTag, row.post, weight * decayWeight(row.createdAt, now));
  }
  for (const row of hashtagOpens) {
    addTagSignal(
      affinityByTag,
      row.query.slice(1),
      SIGNAL_WEIGHTS.hashtagOpen * decayWeight(row.createdAt, now),
    );
  }

  return affinityByTag;
}

/** A candidate's score is the average of tags for which the viewer has a signal. */
export function postHashtagAffinity(
  tags: string[],
  affinityByTag: ReadonlyMap<string, number>,
): number {
  const matched = tags
    .map((tag) => affinityByTag.get(normalizeHashtag(tag)))
    .filter((value): value is number => value !== undefined);
  if (matched.length === 0) return 0;
  return matched.reduce((sum, value) => sum + value, 0) / matched.length;
}
