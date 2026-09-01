import { Prisma, type ProfileType, type RsvpStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { PostMediaItem } from "@/lib/post-shared";
import { getLiveStreamIdsByProvider, getPresenceStatus, type PresenceStatus } from "@/lib/presence";

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
} as const;

const commentAuthorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  lastActiveAt: true,
  showActivityStatus: true,
} as const;

type RawPost = {
  id: string;
  content: string;
  mediaUrls: unknown;
  postType: "standard" | "event" | "live";
  eventId: string | null;
  isSubscriberOnly: boolean;
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
  };
  event: {
    id: string;
    title: string;
    description: string;
    eventType: string;
    startTime: Date;
    endTime: Date;
    venueName: string;
    address: string;
    city: string;
    maxAttendees: number | null;
    currentAttendees: number;
    priceCents: number;
    isPrivate: boolean;
    coverImageUrl: string;
    hostId: string;
    rsvps: { status: RsvpStatus }[];
  } | null;
  comments: RawComment[];
  reactions: { id: string }[];
  _count: { comments: number; reactions: number; shares: number };
};

type PostLockReason = "subscriber_only";

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
  };
  replies?: RawComment[];
};

export type PostEventView = {
  id: string;
  title: string;
  description: string;
  eventType: string;
  startTime: string;
  endTime: string;
  venueName: string;
  address: string;
  city: string;
  maxAttendees: number | null;
  currentAttendees: number;
  priceCents: number;
  isPrivate: boolean;
  coverImageUrl: string;
  hostId: string;
  viewerRsvpStatus: "going" | "interested" | "not_going" | null;
};

export type PostView = {
  id: string;
  content: string | null;
  mediaUrls: string[];
  mediaItems: PostMediaItem[];
  postType: "standard" | "event" | "live";
  event: PostEventView | null;
  isSubscriberOnly: boolean;
  locked: boolean;
  lockReason: PostLockReason | null;
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
  hasSubscriberAccess: boolean,
  viewerProfileId: string | null = null,
  liveStreamIds: Map<string, string> = new Map(),
): PostView {
  const lockReason: PostLockReason | null =
    post.isSubscriberOnly && !hasSubscriberAccess ? "subscriber_only" : null;
  const locked = lockReason !== null;
  const mediaItems = toMediaItems(post.mediaUrls);

  return {
    id: post.id,
    isSubscriberOnly: post.isSubscriberOnly,
    postType: post.postType,
    createdAt: post.createdAt.toISOString(),
    locked,
    lockReason,
    viewCount: post.viewCount,
    isPinned: post.pinnedAt !== null,
    content: locked ? null : post.content,
    mediaUrls: locked ? [] : mediaItems.map((item) => item.url),
    mediaItems: locked ? [] : mediaItems,
    event:
      locked || !post.event
        ? null
        : {
            id: post.event.id,
            title: post.event.title,
            description: post.event.description,
            eventType: post.event.eventType,
            startTime: post.event.startTime.toISOString(),
            endTime: post.event.endTime.toISOString(),
            venueName: post.event.venueName,
            address: post.event.address,
            city: post.event.city,
            maxAttendees: post.event.maxAttendees,
            currentAttendees: post.event.currentAttendees,
            priceCents: post.event.priceCents,
            isPrivate: post.event.isPrivate,
            coverImageUrl: post.event.coverImageUrl,
            hostId: post.event.hostId,
            viewerRsvpStatus:
              post.event.rsvps[0]?.status === "waitlist"
                ? null
                : ((post.event.rsvps[0]?.status as
                    | "going"
                    | "interested"
                    | "not_going"
                    | undefined) ?? null),
          },
    author: {
      id: post.author.id,
      username: post.author.username,
      displayName: post.author.displayName,
      avatarUrl: post.author.avatarUrl,
      profileType: post.author.profileType,
      presenceStatus: getPresenceStatus(post.author, liveStreamIds.has(post.author.id)),
      activeStreamId: liveStreamIds.get(post.author.id) ?? null,
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
    eventId: true,
    isSubscriberOnly: true,
    viewCount: true,
    pinnedAt: true,
    createdAt: true,
    author: { select: postAuthorSelect },
    event: {
      select: {
        id: true,
        title: true,
        description: true,
        eventType: true,
        startTime: true,
        endTime: true,
        venueName: true,
        address: true,
        city: true,
        maxAttendees: true,
        currentAttendees: true,
        priceCents: true,
        isPrivate: true,
        coverImageUrl: true,
        hostId: true,
        rsvps: {
          where: { userId: viewerProfileId ?? "__anonymous__" },
          select: { status: true },
          take: 1,
        },
      },
    },
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

export async function isActiveSubscriber(
  subscriberId: string,
  creatorId: string,
): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      subscriberId,
      creatorId,
      status: "active",
      endsAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return Boolean(subscription);
}

export async function getCreatorProfilePosts(
  creatorProfileId: string,
  viewerProfileId: string | null,
): Promise<PostView[]> {
  const isOwner = viewerProfileId === creatorProfileId;
  const hasSubscriberAccess =
    isOwner ||
    (viewerProfileId
      ? await isActiveSubscriber(viewerProfileId, creatorProfileId)
      : false);

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
  return posts.map((post) => toPostView(post, hasSubscriberAccess, viewerProfileId, liveStreamIds));
}

export async function getFeedPosts(
  viewerProfileId: string | null,
): Promise<PostView[]> {
  const subscriptions = viewerProfileId
    ? await prisma.subscription.findMany({
        where: {
          subscriberId: viewerProfileId,
          status: "active",
          endsAt: { gt: new Date() },
        },
        select: { creatorId: true },
      })
    : [];

  const subscribedCreatorIds = new Set(
    subscriptions.map((sub) => sub.creatorId),
  );

  const where =
    subscribedCreatorIds.size > 0
      ? { authorId: { in: Array.from(subscribedCreatorIds) } }
      : { author: { profileType: "CREATOR" as const, isIncognito: false } };

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
  return posts.map((post) =>
    toPostView(
      post,
      post.author.id === viewerProfileId || subscribedCreatorIds.has(post.author.id),
      viewerProfileId,
      liveStreamIds,
    ),
  );
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

    const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds(posts));
    return posts.map((post) =>
      toPostView(post, post.author.id === viewerProfileId || !post.isSubscriberOnly, viewerProfileId, liveStreamIds),
    );
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

      const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds(posts));
      return posts.map((post) =>
        toPostView(post, post.author.id === viewerProfileId || !post.isSubscriberOnly, viewerProfileId, liveStreamIds),
      );
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
  const hasSubscriberAccess =
    isOwner ||
    (viewerProfileId
      ? await isActiveSubscriber(viewerProfileId, post.author.id)
      : false);

  const liveStreamIds = await getLiveStreamIdsByProvider(collectPostAuthorIds([post]));
  return toPostView(post, hasSubscriberAccess, viewerProfileId, liveStreamIds);
}
