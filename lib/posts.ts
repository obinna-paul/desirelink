import { Prisma, type ProfileType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PostMediaItem } from "@/lib/post-shared";
import { getLiveStreamIdsByProvider, getPresenceStatus, type PresenceStatus } from "@/lib/presence";
import {
  getCreatorAccess,
  resolvePostAccess,
  type CreatorAccessInfo,
  type RequiredTier,
} from "@/lib/subscription-access";
import { getPublicTiersForCreators, type PublicTierView } from "@/lib/tiers";

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
  _count: { comments: number; reactions: number; shares: number };
};

type PostLockReason = "subscriber_only";

/** A pitch to subscribe, shown on a free post as a lead-magnet pull toward the creator's
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
  /** A subscribe pitch attached to this specific post - see PostSubscribePrompt. Only
   * ever set by getPublicFeedPosts, on the first free post per creator in the feed. */
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
            (item.displayAspectRatio === "square" ||
              item.displayAspectRatio === "portrait_3_4" ||
              item.displayAspectRatio === "full_9_16")
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
): PostView {
  const { unlocked, requiredTier } = resolvePostAccess(
    { authorId: post.author.id, isSubscriberOnly: post.isSubscriberOnly, tier: post.tier },
    access,
    viewerProfileId,
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

  const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds(posts));
  return posts.map((post) => toPostView(post, access, viewerProfileId, liveStreamIds));
}

export type PremiumFeedResult = {
  posts: PostView[];
  /** Whether the viewer has any active subscription at all - drives the Premium tab's
   * empty-state vs. end-of-list "find more creators" prompt (see FeedTabs). */
  hasSubscriptions: boolean;
};

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

  const subscribedCreatorIds = Array.from(
    new Set([...providerSubs.map((sub) => sub.providerId), ...legacySubs.map((sub) => sub.creatorId)]),
  );
  if (subscribedCreatorIds.length === 0) {
    return { posts: [], hasSubscriptions: false };
  }

  const access = await getCreatorAccess(viewerProfileId, subscribedCreatorIds);

  // Filters to accessible posts in the query itself (per creator: either an untiered
  // post, since any active subscription unlocks those, or one priced at or below the
  // viewer's paid tier) rather than over-fetching and filtering in JS - otherwise
  // `take: FEED_LIMIT` could return fewer than FEED_LIMIT posts even when more
  // accessible ones exist further back, since some of the "top FEED_LIMIT newest" could
  // belong to a tier above what the viewer holds.
  const perCreatorAccess: Prisma.PostWhereInput[] = subscribedCreatorIds.flatMap((creatorId) => {
    const info = access.get(creatorId);
    if (!info) return [];
    const tierClauses: Prisma.PostWhereInput[] = [];
    if (info.hasAnySub) tierClauses.push({ tierId: null });
    if (info.maxTierPriceCents !== null) {
      tierClauses.push({ tier: { priceCents: { lte: info.maxTierPriceCents } } });
    }
    return tierClauses.length > 0 ? [{ authorId: creatorId, OR: tierClauses }] : [];
  });

  if (perCreatorAccess.length === 0) {
    return { posts: [], hasSubscriptions: true };
  }

  const where = {
    isSubscriberOnly: true,
    author: { isIncognito: false, isSuspended: false },
    OR: perCreatorAccess,
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
 * Attaches a subscribe pitch to the first free post per creator in a feed page - a lead
 * magnet: a verified creator's free posts pull viewers toward their paid tiers. Skips a
 * creator entirely if they have no tiers, or if the viewer already holds (or has pending)
 * one of their tiers - there's nothing left to pitch. Tier state for every candidate
 * creator is fetched in one batch (getPublicTiersForCreators) rather than per-creator, so
 * this stays cheap regardless of how many distinct creators appear in the page.
 */
async function computeSubscribePrompts(
  posts: RawPost[],
  viewerProfileId: string | null,
): Promise<Map<string, PostSubscribePrompt>> {
  const prompts = new Map<string, PostSubscribePrompt>();
  if (!viewerProfileId) return prompts;

  const firstPostIdByCreator = new Map<string, string>();
  const usernameByCreator = new Map<string, string>();

  for (const post of posts) {
    if (post.isSubscriberOnly) continue;
    if (post.author.id === viewerProfileId) continue;
    if (firstPostIdByCreator.has(post.author.id)) continue;

    const isVerifiedAny =
      post.author.isVerified || post.author.isVerifiedCreator || post.author.isVerifiedServiceProvider;
    if (!isVerifiedAny) continue;

    firstPostIdByCreator.set(post.author.id, post.id);
    usernameByCreator.set(post.author.id, post.author.username);
  }

  if (firstPostIdByCreator.size === 0) return prompts;

  const tiersByCreator = await getPublicTiersForCreators(
    Array.from(firstPostIdByCreator.keys()),
    viewerProfileId,
  );

  for (const [creatorId, postId] of Array.from(firstPostIdByCreator)) {
    const tiers = tiersByCreator.get(creatorId) ?? [];
    const alreadyEngaged = tiers.some((tier) => tier.viewerState === "subscribed");
    if (alreadyEngaged) continue;

    const available = tiers.filter((tier) => tier.viewerState === "available");
    if (available.length === 0) continue;

    prompts.set(postId, {
      providerId: creatorId,
      providerUsername: usernameByCreator.get(creatorId)!,
      tiers: available,
    });
  }

  return prompts;
}

export async function getPublicFeedPosts(
  viewerProfileId: string | null,
): Promise<PostView[]> {
  try {
    const posts = await prisma.post.findMany({
      where: {
        isArchived: false,
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
  } catch (error) {
    if (isMissingPostArchiveError(error)) {
      console.warn(
        "Post archive filtering is unavailable until Post.isArchived migration is applied.",
      );
      const posts = await prisma.post.findMany({
        where: {
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

  const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds([post]));
  return toPostView(post, access, viewerProfileId, liveStreamIds);
}
