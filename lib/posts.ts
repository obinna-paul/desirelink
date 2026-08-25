import { prisma } from "@/lib/prisma";

export const MAX_POST_IMAGES = 4;
const FEED_LIMIT = 30;
const PROFILE_POSTS_LIMIT = 50;

const postAuthorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

type RawPost = {
  id: string;
  content: string;
  mediaUrls: unknown;
  isSubscriberOnly: boolean;
  createdAt: Date;
  author: { id: string; username: string; displayName: string; avatarUrl: string };
};

export type PostView = {
  id: string;
  content: string | null;
  mediaUrls: string[];
  isSubscriberOnly: boolean;
  locked: boolean;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl: string };
};

function toMediaUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toPostView(post: RawPost, hasSubscriberAccess: boolean): PostView {
  const locked = post.isSubscriberOnly && !hasSubscriberAccess;

  return {
    id: post.id,
    isSubscriberOnly: post.isSubscriberOnly,
    createdAt: post.createdAt.toISOString(),
    locked,
    content: locked ? null : post.content,
    mediaUrls: locked ? [] : toMediaUrls(post.mediaUrls),
    author: post.author,
  };
}

export async function isActiveSubscriber(subscriberId: string, creatorId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: { subscriberId, creatorId, status: "active", endsAt: { gt: new Date() } },
    select: { id: true },
  });
  return Boolean(subscription);
}

export async function getCreatorProfilePosts(
  creatorProfileId: string,
  viewerProfileId: string | null
): Promise<PostView[]> {
  const isOwner = viewerProfileId === creatorProfileId;
  const hasSubscriberAccess =
    isOwner || (viewerProfileId ? await isActiveSubscriber(viewerProfileId, creatorProfileId) : false);

  const posts = await prisma.post.findMany({
    where: { authorId: creatorProfileId },
    orderBy: { createdAt: "desc" },
    take: PROFILE_POSTS_LIMIT,
    select: {
      id: true,
      content: true,
      mediaUrls: true,
      isSubscriberOnly: true,
      createdAt: true,
      author: { select: postAuthorSelect },
    },
  });

  return posts.map((post) => toPostView(post, hasSubscriberAccess));
}

export async function getFeedPosts(viewerProfileId: string | null): Promise<PostView[]> {
  const subscriptions = viewerProfileId
    ? await prisma.subscription.findMany({
        where: { subscriberId: viewerProfileId, status: "active", endsAt: { gt: new Date() } },
        select: { creatorId: true },
      })
    : [];

  const subscribedCreatorIds = new Set(subscriptions.map((sub) => sub.creatorId));

  const where =
    subscribedCreatorIds.size > 0
      ? { authorId: { in: Array.from(subscribedCreatorIds) } }
      : { author: { profileType: "CREATOR" as const, isIncognito: false } };

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: FEED_LIMIT,
    select: {
      id: true,
      content: true,
      mediaUrls: true,
      isSubscriberOnly: true,
      createdAt: true,
      author: { select: postAuthorSelect },
    },
  });

  return posts.map((post) =>
    toPostView(post, post.author.id === viewerProfileId || subscribedCreatorIds.has(post.author.id))
  );
}
