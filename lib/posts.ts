import { Prisma, type ProfileType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isPostDisplayAspectRatio, type PostMediaItem } from "@/lib/post-shared";
import { getLiveStreamIdsByProvider, getPresenceStatus, type PresenceStatus } from "@/lib/presence";
import {
  getCreatorAccess,
  getUnlockedPostIds,
  resolvePostAccess,
  type CreatorAccessInfo,
  type RequiredTier,
} from "@/lib/subscription-access";
import { getPublicTiersForCreators, type PublicTierView } from "@/lib/tiers";
import { selectSubscribePromptPostIds } from "@/lib/subscribe-prompt-frequency";
import { getFollowingIds } from "@/lib/follow";
import { normalizeHashtag } from "@/lib/hashtags";
import { getHiddenCreatorIds } from "@/lib/content-feedback";
import {
  HOME_FEED_SESSION_SEED,
  isFeedRankingEnabled,
  isInRankingHoldout,
  rankFeedPosts,
} from "@/lib/ranking/engine";
import { affinityTerm, recencyTerm } from "@/lib/recommendation-scoring";
import { getAffinityByCreator } from "@/lib/ranking/people-scoring";

const FEED_LIMIT = 30;
const PROFILE_POSTS_LIMIT = 50;

function isMissingSchemaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function isMissingPostArchiveError(error: unknown): boolean {
  const target =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? String(error.meta?.table ?? error.meta?.column ?? "")
      : "";

  return (
    isMissingSchemaError(error) &&
    (target.includes("Post.isArchived") || target.includes("isArchived"))
  );
}

const postAuthorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  profileType: true,
  lastActiveAt: true,
  showActivityStatus: true,
  isVerified: true,
  isVerifiedCreator: true,
  isVerifiedServiceProvider: true,
  verificationPending: true,
} as const;

const commentAuthorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  lastActiveAt: true,
  showActivityStatus: true,
  isVerified: true,
  isVerifiedCreator: true,
  isVerifiedServiceProvider: true,
  verificationPending: true,
} as const;

type RawPost = {
  id: string;
  content: string;
  mediaUrls: unknown;
  postType: "standard" | "live";
  isSubscriberOnly: boolean;
  tier: { id: string; name: string; priceCents: number } | null;
  viewCount: number;
  pinnedAt: Date | null;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    profileType: ProfileType;
    lastActiveAt: Date | null;
    showActivityStatus: boolean;
    isVerified: boolean;
    isVerifiedCreator: boolean;
    isVerifiedServiceProvider: boolean;
    verificationPending: boolean;
  };
  comments: RawComment[];
  reactions: { id: string }[];
  savedByViewer: { id: string }[];
  _count: { comments: number; reactions: number; shares: number };
};

type PostLockReason = "subscriber_only";

/** A pitch to subscribe, shown on eligible free posts as a pull toward the creator's
 * paid tiers - see computeSubscribePrompts, used only by getPublicFeedPosts. */
export type PostSubscribePrompt = {
  providerId: string;
  providerUsername: string;
  tiers: PublicTierView[];
};

export type PostCommentView = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    presenceStatus: PresenceStatus;
    activeStreamId: string | null;
    isVerified: boolean;
    isVerifiedCreator: boolean;
    isVerifiedServiceProvider: boolean;
    verificationPending: boolean;
  };
  replies: PostCommentView[];
};

type RawComment = {
  id: string;
  content: string;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    lastActiveAt: Date | null;
    showActivityStatus: boolean;
    isVerified: boolean;
    isVerifiedCreator: boolean;
    isVerifiedServiceProvider: boolean;
    verificationPending: boolean;
  };
  replies?: RawComment[];
};

export type PostView = {
  id: string;
  content: string | null;
  mediaUrls: string[];
  mediaItems: PostMediaItem[];
  postType: "standard" | "live";
  isSubscriberOnly: boolean;
  locked: boolean;
  lockReason: PostLockReason | null;
  /** The tier that unlocks this post, when locked - null for a free post, an unlocked
   * post, or a premium post with no tier assigned (any active subscription unlocks it). */
  requiredTier: RequiredTier | null;
  /** A heavily blurred still image safe to show someone who hasn't unlocked this post -
   * see toLockedPreview. Null for an unlocked post, or a locked post with no media. */
  blurredPreview: LockedPostPreview | null;
  /** A subscribe pitch attached to this specific post - see PostSubscribePrompt. Only
   * ever set by getPublicFeedPosts on eligible free posts in the For You feed. */
  subscribePrompt: PostSubscribePrompt | null;
  viewCount: number;
  isPinned: boolean;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    profileType: ProfileType;
    presenceStatus: PresenceStatus;
    activeStreamId: string | null;
    isVerified: boolean;
    isVerifiedCreator: boolean;
    isVerifiedServiceProvider: boolean;
    verificationPending: boolean;
  };
  counts: { comments: number; reactions: number; shares: number };
  viewerLiked: boolean;
  viewerSaved: boolean;
  viewerCanManage: boolean;
  viewerCanEdit: boolean;
  comments: PostCommentView[];
};

export function toMediaItems(value: unknown): PostMediaItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item === "string") {
      return [{ url: item, type: "image" as const }];
    }
    if (
      item &&
      typeof item === "object" &&
      "url" in item &&
      typeof item.url === "string" &&
      "type" in item &&
      (item.type === "image" || item.type === "video")
    ) {
      return [
        {
          url: item.url,
          type: item.type,
          width: typeof item.width === "number" ? item.width : undefined,
          height: typeof item.height === "number" ? item.height : undefined,
          durationSeconds:
            typeof item.durationSeconds === "number"
              ? item.durationSeconds
              : undefined,
          displayAspectRatio:
            "displayAspectRatio" in item &&
            isPostDisplayAspectRatio(item.displayAspectRatio)
              ? item.displayAspectRatio
              : undefined,
          crop:
            "crop" in item &&
            item.crop &&
            typeof item.crop === "object" &&
            "zoom" in item.crop &&
            "offsetXFrac" in item.crop &&
            "offsetYFrac" in item.crop &&
            typeof item.crop.zoom === "number" &&
            typeof item.crop.offsetXFrac === "number" &&
            typeof item.crop.offsetYFrac === "number"
              ? {
                  zoom: item.crop.zoom,
                  offsetXFrac: item.crop.offsetXFrac,
                  offsetYFrac: item.crop.offsetYFrac,
                }
              : undefined,
        },
      ];
    }
    return [];
  });
}

export type LockedPostPreview = { url: string; cssBlur: boolean };

/**
 * A safe-to-show, heavily blurred still image for a locked post's first media item - the
 * whole point of a locked post is that mediaItems is sent empty (see toPostView below), so
 * this must never be the real asset. Cloudinary media gets a genuine blur baked in by
 * Cloudinary's own e_blur transform, server-side - the client never receives the
 * unblurred bytes at all, unlike a CSS filter someone could just strip in devtools.
 * Bunny Stream doesn't offer that kind of URL transform, so its fixed thumbnail path is
 * used with cssBlur instead - a much smaller leak than the source video would be (one
 * static preview frame, not the clip itself).
 */
function toLockedPreview(media: PostMediaItem | undefined): LockedPostPreview | null {
  if (!media) return null;

  if (media.url.includes(".m3u8")) {
    return { url: media.url.replace(/\/playlist\.m3u8(?:\?.*)?$/, "/thumbnail.jpg"), cssBlur: true };
  }

  try {
    const parsed = new URL(media.url);
    if (parsed.hostname !== "res.cloudinary.com") return null;

    const uploadMarker = media.type === "video" ? "/video/upload/" : "/image/upload/";
    const markerIndex = parsed.pathname.indexOf(uploadMarker);
    if (markerIndex === -1) return null;

    const before = parsed.pathname.slice(0, markerIndex + uploadMarker.length);
    const after = parsed.pathname.slice(markerIndex + uploadMarker.length);
    const transform = media.type === "video" ? "so_0,e_blur:2000,q_auto,w_400" : "e_blur:2000,q_auto,w_400";
    // A video's still frame is requested via the same path, a start-offset flag, and a
    // .jpg extension in place of the video's own.
    const path = media.type === "video" ? after.replace(/\.[a-z0-9]+$/i, ".jpg") : after;

    parsed.pathname = `${before}${transform}/${path}`;
    return { url: parsed.toString(), cssBlur: false };
  } catch {
    return null;
  }
}

function toCommentView(comment: RawComment, liveStreamIds: Map<string, string>): PostCommentView {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: comment.author.id,
      username: comment.author.username,
      displayName: comment.author.displayName,
      avatarUrl: comment.author.avatarUrl,
      presenceStatus: getPresenceStatus(comment.author, liveStreamIds.has(comment.author.id)),
      activeStreamId: liveStreamIds.get(comment.author.id) ?? null,
      isVerified: comment.author.isVerified,
      isVerifiedCreator: comment.author.isVerifiedCreator,
      isVerifiedServiceProvider: comment.author.isVerifiedServiceProvider,
      verificationPending: comment.author.verificationPending,
    },
    replies: (comment.replies ?? []).map((reply) => toCommentView(reply, liveStreamIds)),
  };
}

/** Collects every author id appearing in a page of posts (post authors + preview-comment
 * authors, one level of replies deep) so callers can batch a single live-status lookup
 * instead of querying per post. */
function collectPostAuthorIds(posts: RawPost[]): string[] {
  const ids = new Set<string>();
  for (const post of posts) {
    ids.add(post.author.id);
    for (const comment of post.comments) {
      ids.add(comment.author.id);
      for (const reply of comment.replies ?? []) {
        ids.add(reply.author.id);
      }
    }
  }
  return Array.from(ids);
}

function toPostView(
  post: RawPost,
  access: Map<string, CreatorAccessInfo>,
  viewerProfileId: string | null = null,
  liveStreamIds: Map<string, string> = new Map(),
  unlockedPostIds: Set<string> = new Set(),
): PostView {
  const { unlocked, requiredTier } = resolvePostAccess(
    { id: post.id, authorId: post.author.id, isSubscriberOnly: post.isSubscriberOnly, tier: post.tier },
    access,
    viewerProfileId,
    unlockedPostIds,
  );
  const lockReason: PostLockReason | null = post.isSubscriberOnly && !unlocked ? "subscriber_only" : null;
  const locked = lockReason !== null;
  const mediaItems = toMediaItems(post.mediaUrls);

  return {
    id: post.id,
    isSubscriberOnly: post.isSubscriberOnly,
    postType: post.postType,
    createdAt: post.createdAt.toISOString(),
    locked,
    lockReason,
    requiredTier: locked ? requiredTier : null,
    blurredPreview: locked ? toLockedPreview(mediaItems[0]) : null,
    subscribePrompt: null,
    viewCount: post.viewCount,
    isPinned: post.pinnedAt !== null,
    content: locked ? null : post.content,
    mediaUrls: locked ? [] : mediaItems.map((item) => item.url),
    mediaItems: locked ? [] : mediaItems,
    author: {
      id: post.author.id,
      username: post.author.username,
      displayName: post.author.displayName,
      avatarUrl: post.author.avatarUrl,
      profileType: post.author.profileType,
      presenceStatus: getPresenceStatus(post.author, liveStreamIds.has(post.author.id)),
      activeStreamId: liveStreamIds.get(post.author.id) ?? null,
      isVerified: post.author.isVerified,
      isVerifiedCreator: post.author.isVerifiedCreator,
      isVerifiedServiceProvider: post.author.isVerifiedServiceProvider,
      verificationPending: post.author.verificationPending,
    },
    counts: post._count,
    viewerLiked: post.reactions.length > 0,
    viewerSaved: post.savedByViewer.length > 0,
    viewerCanManage: post.author.id === viewerProfileId,
    viewerCanEdit: post.author.id === viewerProfileId,
    comments: locked ? [] : post.comments.map((comment) => toCommentView(comment, liveStreamIds)),
  };
}

function postSelect(viewerProfileId: string | null) {
  return {
    id: true,
    content: true,
    mediaUrls: true,
    postType: true,
    isSubscriberOnly: true,
    tier: { select: { id: true, name: true, priceCents: true } },
    viewCount: true,
    pinnedAt: true,
    createdAt: true,
    author: { select: postAuthorSelect },
    reactions: {
      where: {
        userId: viewerProfileId ?? "__anonymous__",
        type: "like" as const,
      },
      select: { id: true },
      take: 1,
    },
    savedByViewer: {
      where: { viewerId: viewerProfileId ?? "__anonymous__" },
      select: { id: true },
      take: 1,
    },
    comments: {
      where: { parentId: null },
      orderBy: { createdAt: "desc" as const },
      take: 2,
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: commentAuthorSelect },
        replies: {
          orderBy: { createdAt: "asc" as const },
          take: 2,
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: { select: commentAuthorSelect },
          },
        },
      },
    },
    _count: { select: { comments: true, reactions: true, shares: true } },
  };
}

/** Whether the viewer has any active subscription at all to this creator - checks both
 * ProviderSubscription and the legacy Subscription table (see getCreatorAccess). Used to
 * gate liking/commenting/sharing a locked post, which - unlike viewing it - only cares
 * about "are you a paying subscriber", not which specific tier the post requires. */
export async function isActiveSubscriber(
  subscriberId: string,
  creatorId: string,
): Promise<boolean> {
  const access = await getCreatorAccess(subscriberId, [creatorId]);
  return access.get(creatorId)?.hasAnySub ?? false;
}

export async function getCreatorProfilePosts(
  creatorProfileId: string,
  viewerProfileId: string | null,
): Promise<PostView[]> {
  const isOwner = viewerProfileId === creatorProfileId;
  const access = isOwner
    ? new Map<string, CreatorAccessInfo>()
    : await getCreatorAccess(viewerProfileId, [creatorProfileId]);

  const profilePostsOrderBy = [
    { pinnedAt: { sort: "desc" as const, nulls: "last" as const } },
    { createdAt: "desc" as const },
  ];

  let posts: RawPost[];
  try {
    posts = await prisma.post.findMany({
      where: { authorId: creatorProfileId, isArchived: false },
      orderBy: profilePostsOrderBy,
      take: PROFILE_POSTS_LIMIT,
      select: postSelect(viewerProfileId),
    });
  } catch (error) {
    if (!isMissingPostArchiveError(error)) throw error;
    console.warn(
      "Post archive filtering is unavailable until Post.isArchived migration is applied.",
    );
    posts = await prisma.post.findMany({
      where: { authorId: creatorProfileId },
      orderBy: profilePostsOrderBy,
      take: PROFILE_POSTS_LIMIT,
      select: postSelect(viewerProfileId),
    });
  }

  const postIds = posts.map((post) => post.id);
  const [liveStreamIds, unlockedPostIds, tiersByCreator] = await Promise.all([
    getLiveStreamIdsByProvider(collectPostAuthorIds(posts)),
    isOwner ? new Set<string>() : getUnlockedPostIds(viewerProfileId, postIds),
    isOwner ? new Map<string, PublicTierView[]>() : getPublicTiersForCreators([creatorProfileId], viewerProfileId),
  ]);
  const availableTiers = (tiersByCreator.get(creatorProfileId) ?? []).filter(
    (tier) => tier.viewerState === "available",
  );

  return posts.map((post) => {
    const view = toPostView(post, access, viewerProfileId, liveStreamIds, unlockedPostIds);
    if (!view.locked || availableTiers.length === 0) return view;
    return {
      ...view,
      subscribePrompt: { providerId: creatorProfileId, providerUsername: post.author.username, tiers: availableTiers },
    };
  });
}

export type PremiumFeedResult = {
  posts: PostView[];
  /** Whether the viewer has any active subscription at all - drives the Premium tab's
   * empty-state vs. end-of-list "find more creators" prompt (see FeedTabs). */
  hasSubscriptions: boolean;
};

export type PremiumAccessRow = { creatorId: string; maxTierPriceCents: number | null };

/** Overfetch multiplier for the premium candidate query, so the unseen/freshness/affinity
 * ranking pass below has room to reorder before truncating to FEED_LIMIT - the same pattern
 * used for the Live ring and Discover's recommended sort. */
const PREMIUM_CANDIDATE_MULTIPLIER = 3;

/**
 * A single query for "every subscriber-only post this viewer has paid-tier access to,"
 * replacing what used to be one `{authorId, OR: tierClauses}` entry per subscribed creator
 * (a query that grew linearly with subscription count). Joins Post against a VALUES list of
 * (creatorId, maxTierPriceCents) pairs instead - one join, however many creators. An untiered
 * post is accessible to any subscribed creator (`t."priceCents" <= access.max_price_cents`
 * evaluates to SQL NULL, i.e. excluded, when that creator's own price is NULL - a creator with
 * no known tier price still gets their untiered posts via the `p."tierId" IS NULL` branch).
 * Author eligibility (isIncognito/isSuspended) and isArchived are filtered here, in SQL,
 * before the LIMIT - filtering after the fact could return fewer than the limit even when
 * more accessible posts exist further back.
 */
export async function selectEligiblePremiumPostIds(accessRows: PremiumAccessRow[], limit: number): Promise<string[]> {
  if (accessRows.length === 0) return [];

  const valuesList = Prisma.join(
    accessRows.map((row) => Prisma.sql`(${row.creatorId}, ${row.maxTierPriceCents}::integer)`),
  );

  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT p.id
    FROM "Post" p
    JOIN "Profile" author ON author.id = p."authorId"
    JOIN (VALUES ${valuesList}) AS access(creator_id, max_price_cents)
      ON p."authorId" = access.creator_id
    LEFT JOIN "CreatorTier" t ON t.id = p."tierId"
    WHERE p."isSubscriberOnly" = true
      AND p."isArchived" = false
      AND author."isIncognito" = false
      AND author."isSuspended" = false
      AND (p."tierId" IS NULL OR t."priceCents" <= access.max_price_cents)
    ORDER BY p."createdAt" DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => row.id);
}

/** Original per-creator-OR-clause query, kept as the fallback if the efficient raw-SQL path
 * above fails for any reason (e.g. a schema mismatch the raw query doesn't degrade from as
 * gracefully as Prisma's own generated queries do) - correctness over efficiency when the
 * efficient path can't run at all. Not ranked by unseen/freshness/affinity - a plain
 * chronological degrade is an acceptable trade for a path that should rarely execute. */
async function getPremiumFeedPostsLegacy(
  accessRows: PremiumAccessRow[],
  viewerProfileId: string,
): Promise<RawPost[]> {
  const perCreatorAccess: Prisma.PostWhereInput[] = accessRows.map((row) => {
    const tierClauses: Prisma.PostWhereInput[] = [{ tierId: null }];
    if (row.maxTierPriceCents !== null) {
      tierClauses.push({ tier: { priceCents: { lte: row.maxTierPriceCents } } });
    }
    return { authorId: row.creatorId, OR: tierClauses };
  });

  const where = {
    isSubscriberOnly: true,
    author: { isIncognito: false, isSuspended: false },
    OR: perCreatorAccess,
  };

  try {
    return await prisma.post.findMany({
      where: { ...where, isArchived: false },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: postSelect(viewerProfileId),
    });
  } catch (error) {
    if (!isMissingPostArchiveError(error)) throw error;
    console.warn("Post archive filtering is unavailable until Post.isArchived migration is applied.");
    return prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: postSelect(viewerProfileId),
    });
  }
}

/**
 * Ranks premium candidates unseen-first (no PostImpression from this viewer yet), then by
 * freshness + affinity within each group - per the discovery/ranking plan. A hard partition
 * on "unseen," not a soft score bonus, mirrors the Live ring's "live always first" precedent:
 * a fan should see something new from a creator they pay for before anything already viewed.
 */
export async function rankPremiumPosts(
  posts: RawPost[],
  viewerProfileId: string,
  subscribedCreatorIds: string[],
  now: Date = new Date(),
): Promise<RawPost[]> {
  if (posts.length === 0) return posts;

  const postIds = posts.map((post) => post.id);
  const [seenRows, affinityByCreator] = await Promise.all([
    prisma.postImpression.findMany({
      where: { viewerId: viewerProfileId, postId: { in: postIds } },
      select: { postId: true },
    }),
    getAffinityByCreator(viewerProfileId, subscribedCreatorIds),
  ]);
  const seenPostIds = new Set(seenRows.map((row) => row.postId));

  return posts
    .map((post) => ({
      post,
      seen: seenPostIds.has(post.id),
      score: 0.5 * recencyTerm(post.createdAt, now) + 0.5 * affinityTerm(affinityByCreator.get(post.author.id) ?? 0),
    }))
    .sort((a, b) => {
      if (a.seen !== b.seen) return a.seen ? 1 : -1;
      return b.score - a.score;
    })
    .map((entry) => entry.post);
}

/**
 * Premium posts from creators the viewer is actively subscribed to, restricted further to
 * posts at or below the tier the viewer actually paid for (tiers are cumulative - see
 * resolvePostAccess). Anything above that tier is filtered out of the result entirely
 * rather than returned as a locked card - the Premium tab never shows a "Subscribe to
 * Unlock" teaser for content from a creator the viewer already subscribes to at a lower tier.
 */
export async function getPremiumFeedPosts(
  viewerProfileId: string | null,
): Promise<PremiumFeedResult> {
  if (!viewerProfileId) {
    return { posts: [], hasSubscriptions: false };
  }

  const now = new Date();
  const [providerSubs, legacySubs] = await Promise.all([
    prisma.providerSubscription.findMany({
      where: { subscriberId: viewerProfileId, status: "active", endsAt: { gt: now } },
      select: { providerId: true },
    }),
    prisma.subscription.findMany({
      where: { subscriberId: viewerProfileId, status: "active", endsAt: { gt: now } },
      select: { creatorId: true },
    }),
  ]);

  const allSubscribedCreatorIds = Array.from(
    new Set([...providerSubs.map((sub) => sub.providerId), ...legacySubs.map((sub) => sub.creatorId)]),
  );
  if (allSubscribedCreatorIds.length === 0) {
    return { posts: [], hasSubscriptions: false };
  }

  const hiddenCreatorIds = new Set(await getHiddenCreatorIds(viewerProfileId));
  const subscribedCreatorIds = allSubscribedCreatorIds.filter(
    (creatorId) => !hiddenCreatorIds.has(creatorId),
  );
  if (subscribedCreatorIds.length === 0) {
    return { posts: [], hasSubscriptions: true };
  }

  const access = await getCreatorAccess(viewerProfileId, subscribedCreatorIds);

  const accessRows: PremiumAccessRow[] = subscribedCreatorIds.flatMap((creatorId) => {
    const info = access.get(creatorId);
    return info ? [{ creatorId, maxTierPriceCents: info.maxTierPriceCents }] : [];
  });
  if (accessRows.length === 0) {
    return { posts: [], hasSubscriptions: true };
  }

  let posts: RawPost[];
  try {
    const eligiblePostIds = await selectEligiblePremiumPostIds(accessRows, FEED_LIMIT * PREMIUM_CANDIDATE_MULTIPLIER);
    if (eligiblePostIds.length === 0) {
      posts = [];
    } else {
      const fetched: RawPost[] = await prisma.post.findMany({
        where: { id: { in: eligiblePostIds } },
        select: postSelect(viewerProfileId),
      });
      const byId = new Map(fetched.map((post) => [post.id, post]));
      const inOrder = eligiblePostIds.map((id) => byId.get(id)).filter((post): post is RawPost => Boolean(post));
      posts = (await rankPremiumPosts(inOrder, viewerProfileId, subscribedCreatorIds)).slice(0, FEED_LIMIT);
    }
  } catch (error) {
    console.warn("Efficient premium feed query failed, falling back to the per-creator query.", error);
    posts = await getPremiumFeedPostsLegacy(accessRows, viewerProfileId);
  }

  const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds(posts));
  return {
    posts: posts.map((post) => toPostView(post, access, viewerProfileId, liveStreamIds)),
    hasSubscriptions: true,
  };
}

/** Every subscriber-only post's authors, so getPublicFeedPosts can resolve real tier
 * access instead of blanket-locking them - moot today (FeedTabs' "For You" filters
 * isSubscriberOnly posts out entirely, see components/home/feed-tabs.tsx), but keeps
 * this function's PostView output correct for any future caller that doesn't. */
async function accessForSubscriberOnlyAuthors(
  posts: RawPost[],
  viewerProfileId: string | null,
): Promise<Map<string, CreatorAccessInfo>> {
  const authorIds = posts.filter((post) => post.isSubscriberOnly).map((post) => post.author.id);
  return getCreatorAccess(viewerProfileId, authorIds);
}

/**
 * Adds a restrained subscription cadence to the For You feed: once per creator, no more
 * than three times in a feed load, with two ordinary posts between prompts. Creators with
 * no available tier and viewers who already subscribe are skipped. Tier state remains one
 * batched lookup for all candidate creators.
 */
async function computeSubscribePrompts(
  posts: RawPost[],
  viewerProfileId: string | null,
): Promise<Map<string, PostSubscribePrompt>> {
  const prompts = new Map<string, PostSubscribePrompt>();
  if (!viewerProfileId) return prompts;

  const candidateCreatorIds = new Set<string>();
  const usernameByCreator = new Map<string, string>();

  for (const post of posts) {
    if (post.isSubscriberOnly) continue;
    if (post.author.id === viewerProfileId) continue;

    const isVerifiedAny =
      post.author.isVerified || post.author.isVerifiedCreator || post.author.isVerifiedServiceProvider;
    if (!isVerifiedAny) continue;

    candidateCreatorIds.add(post.author.id);
    usernameByCreator.set(post.author.id, post.author.username);
  }

  if (candidateCreatorIds.size === 0) return prompts;

  const tiersByCreator = await getPublicTiersForCreators(
    Array.from(candidateCreatorIds),
    viewerProfileId,
  );

  const availableTiersByCreator = new Map<string, PublicTierView[]>();
  for (const creatorId of Array.from(candidateCreatorIds)) {
    const tiers = tiersByCreator.get(creatorId) ?? [];
    const alreadyEngaged = tiers.some((tier) => tier.viewerState === "subscribed");
    if (alreadyEngaged) continue;

    const available = tiers.filter((tier) => tier.viewerState === "available");
    if (available.length === 0) continue;
    availableTiersByCreator.set(creatorId, available);
  }

  const selectedPostIds = selectSubscribePromptPostIds(
    posts.map((post) => ({
      id: post.id,
      creatorId: post.author.id,
      isFree: !post.isSubscriberOnly,
      isEligible:
        post.author.id !== viewerProfileId && availableTiersByCreator.has(post.author.id),
    })),
  );

  for (const post of posts) {
    if (!selectedPostIds.has(post.id)) continue;
    prompts.set(post.id, {
      providerId: post.author.id,
      providerUsername: usernameByCreator.get(post.author.id)!,
      tiers: availableTiersByCreator.get(post.author.id)!,
    });
  }

  return prompts;
}

/**
 * Re-orders getPublicFeedPosts's chronological candidates via the ranking engine, when the
 * FEED_RANKING_ENABLED flag is on and this viewer isn't in the holdout group. Ranking only
 * ever reorders - it never shrinks the feed: any post the slate couldn't place (creator caps,
 * the locked-without-affinity gate, see lib/ranking/slate.ts) is appended at the end in its
 * original chronological position, so the feed's length contract never changes. Any failure
 * (including the ranking tables not existing yet) falls back to the untouched chronological
 * order, matching this file's existing degrade-never-500 pattern.
 */
async function applyFeedRanking(
  viewerProfileId: string | null,
  posts: RawPost[],
  postViews: PostView[],
): Promise<PostView[]> {
  if (!viewerProfileId) return postViews;
  if (!isFeedRankingEnabled()) return postViews;
  if (isInRankingHoldout(viewerProfileId)) return postViews;

  try {
    const rankable = posts.map((post, i) => ({
      id: post.id,
      authorId: post.author.id,
      createdAt: post.createdAt,
      locked: postViews[i].locked,
    }));
    const rankedIds = await rankFeedPosts(viewerProfileId, HOME_FEED_SESSION_SEED, rankable);

    const byId = new Map(postViews.map((view) => [view.id, view]));
    const ranked = rankedIds.map((id) => byId.get(id)).filter((view): view is PostView => Boolean(view));
    const includedIds = new Set(rankedIds);
    const leftovers = postViews.filter((view) => !includedIds.has(view.id));
    return [...ranked, ...leftovers];
  } catch (error) {
    console.warn("Feed ranking failed, falling back to chronological order.", error);
    return postViews;
  }
}

export async function getPublicFeedPosts(
  viewerProfileId: string | null,
): Promise<PostView[]> {
  const hiddenCreatorIds = viewerProfileId ? await getHiddenCreatorIds(viewerProfileId) : [];

  try {
    const posts = await prisma.post.findMany({
      where: {
        isArchived: false,
        authorId: hiddenCreatorIds.length > 0 ? { notIn: hiddenCreatorIds } : undefined,
        author: {
          isIncognito: false,
          isSuspended: false,
        },
      },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: postSelect(viewerProfileId),
    });

    const access = await accessForSubscriberOnlyAuthors(posts, viewerProfileId);
    const subscribePrompts = await computeSubscribePrompts(posts, viewerProfileId);
    const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds(posts));
    const postViews = posts.map((post) => ({
      ...toPostView(post, access, viewerProfileId, liveStreamIds),
      subscribePrompt: subscribePrompts.get(post.id) ?? null,
    }));
    return await applyFeedRanking(viewerProfileId, posts, postViews);
  } catch (error) {
    if (isMissingPostArchiveError(error)) {
      console.warn(
        "Post archive filtering is unavailable until Post.isArchived migration is applied.",
      );
      const posts = await prisma.post.findMany({
        where: {
          authorId: hiddenCreatorIds.length > 0 ? { notIn: hiddenCreatorIds } : undefined,
          author: {
            isIncognito: false,
            isSuspended: false,
          },
        },
        orderBy: { createdAt: "desc" },
        take: FEED_LIMIT,
        select: postSelect(viewerProfileId),
      });

      const access = await accessForSubscriberOnlyAuthors(posts, viewerProfileId);
      const subscribePrompts = await computeSubscribePrompts(posts, viewerProfileId);
      const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds(posts));
      return posts.map((post) => ({
        ...toPostView(post, access, viewerProfileId, liveStreamIds),
        subscribePrompt: subscribePrompts.get(post.id) ?? null,
      }));
    }
    if (isMissingSchemaError(error)) {
      console.warn(
        "Home public feed is unavailable until feed interaction migrations are applied.",
      );
      return [];
    }
    throw error;
  }
}

/**
 * Strictly chronological free posts from creators the viewer follows - the trust anchor and
 * fallback surface (see the discovery/ranking plan): Follow never unlocks subscriber-only
 * content, it only surfaces a followed creator's free posts here and enables their go-live
 * notifications.
 */
export async function getFollowingFeedPosts(
  viewerProfileId: string | null,
): Promise<PostView[]> {
  if (!viewerProfileId) return [];

  const [followingIds, hiddenCreatorIds] = await Promise.all([
    getFollowingIds(viewerProfileId),
    getHiddenCreatorIds(viewerProfileId),
  ]);
  const hiddenSet = new Set(hiddenCreatorIds);
  const visibleFollowingIds = followingIds.filter((id) => !hiddenSet.has(id));
  if (visibleFollowingIds.length === 0) return [];

  const where: Prisma.PostWhereInput = {
    authorId: { in: visibleFollowingIds },
    isSubscriberOnly: false,
    author: { isIncognito: false, isSuspended: false },
  };

  let posts: RawPost[];
  try {
    posts = await prisma.post.findMany({
      where: { ...where, isArchived: false },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: postSelect(viewerProfileId),
    });
  } catch (error) {
    if (!isMissingPostArchiveError(error)) throw error;
    console.warn(
      "Post archive filtering is unavailable until Post.isArchived migration is applied.",
    );
    posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: postSelect(viewerProfileId),
    });
  }

  const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds(posts));
  const access = new Map<string, CreatorAccessInfo>();
  return posts.map((post) => toPostView(post, access, viewerProfileId, liveStreamIds));
}

/** Newest-first posts tagged with a given hashtag - the hashtag page's data source. Locked
 * posts still show up (with their usual blurred preview), matching how getPublicFeedPosts
 * treats subscriber-only content elsewhere in the app. */
export async function getPostsByHashtag(
  tag: string,
  viewerProfileId: string | null,
): Promise<PostView[]> {
  const normalized = normalizeHashtag(tag);
  if (!normalized) return [];

  const hiddenCreatorIds = viewerProfileId ? await getHiddenCreatorIds(viewerProfileId) : [];

  const where: Prisma.PostWhereInput = {
    hashtags: { some: { hashtag: { tag: normalized } } },
    authorId: hiddenCreatorIds.length > 0 ? { notIn: hiddenCreatorIds } : undefined,
    author: { isIncognito: false, isSuspended: false },
  };

  let posts: RawPost[];
  try {
    posts = await prisma.post.findMany({
      where: { ...where, isArchived: false },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: postSelect(viewerProfileId),
    });
  } catch (error) {
    if (!isMissingPostArchiveError(error)) throw error;
    console.warn(
      "Post archive filtering is unavailable until Post.isArchived migration is applied.",
    );
    posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: postSelect(viewerProfileId),
    });
  }

  const access = await accessForSubscriberOnlyAuthors(posts, viewerProfileId);
  const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds(posts));
  return posts.map((post) => toPostView(post, access, viewerProfileId, liveStreamIds));
}

/** Fetches specific posts by id, in no particular order - callers that need a specific
 * order (e.g. search results ranked elsewhere) re-sort the returned rows themselves. */
export async function getPostsByIds(
  ids: string[],
  viewerProfileId: string | null,
): Promise<PostView[]> {
  if (ids.length === 0) return [];

  const where: Prisma.PostWhereInput = {
    id: { in: ids },
    author: { isIncognito: false, isSuspended: false },
  };

  let posts: RawPost[];
  try {
    posts = await prisma.post.findMany({
      where: { ...where, isArchived: false },
      select: postSelect(viewerProfileId),
    });
  } catch (error) {
    if (!isMissingPostArchiveError(error)) throw error;
    console.warn(
      "Post archive filtering is unavailable until Post.isArchived migration is applied.",
    );
    posts = await prisma.post.findMany({ where, select: postSelect(viewerProfileId) });
  }

  const access = await accessForSubscriberOnlyAuthors(posts, viewerProfileId);
  const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds(posts));
  return posts.map((post) => toPostView(post, access, viewerProfileId, liveStreamIds));
}

export async function getPostByIdForViewer(
  postId: string,
  viewerProfileId: string | null,
): Promise<PostView | null> {
  let post: RawPost | null;
  try {
    post = await prisma.post.findFirst({
      where: { id: postId, isArchived: false },
      select: postSelect(viewerProfileId),
    });
  } catch (error) {
    if (!isMissingPostArchiveError(error)) throw error;
    console.warn(
      "Post archive filtering is unavailable until Post.isArchived migration is applied.",
    );
    post = await prisma.post.findUnique({
      where: { id: postId },
      select: postSelect(viewerProfileId),
    });
  }
  if (!post) return null;

  const isOwner = viewerProfileId === post.author.id;
  const access = isOwner
    ? new Map<string, CreatorAccessInfo>()
    : await getCreatorAccess(viewerProfileId, [post.author.id]);

  const [liveStreamIds, unlockedPostIds, tiersByCreator] = await Promise.all([
    getLiveStreamIdsByProvider(collectPostAuthorIds([post])),
    isOwner ? new Set<string>() : getUnlockedPostIds(viewerProfileId, [post.id]),
    isOwner
      ? new Map<string, PublicTierView[]>()
      : getPublicTiersForCreators([post.author.id], viewerProfileId),
  ]);

  const view = toPostView(post, access, viewerProfileId, liveStreamIds, unlockedPostIds);
  if (!view.locked) return view;

  const availableTiers = (tiersByCreator.get(post.author.id) ?? []).filter(
    (tier) => tier.viewerState === "available",
  );
  if (availableTiers.length === 0) return view;

  return {
    ...view,
    subscribePrompt: { providerId: post.author.id, providerUsername: post.author.username, tiers: availableTiers },
  };
}
