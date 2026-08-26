import type { ProfileType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  FREE_DAILY_PROVIDER_POST_LIMIT,
  getDailyProviderPostUsage,
  isPremiumUser,
  recordProviderPostView,
} from "@/lib/premium";
import { isProviderProfileType } from "@/lib/provider-types";

const FEED_LIMIT = 30;
const PROFILE_POSTS_LIMIT = 50;

const postAuthorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  profileType: true,
} as const;

type RawPost = {
  id: string;
  content: string;
  mediaUrls: unknown;
  isSubscriberOnly: boolean;
  createdAt: Date;
  author: { id: string; username: string; displayName: string; avatarUrl: string; profileType: ProfileType };
};

type PostLockReason = "subscriber_only" | "premium_provider_limit";

export type PostView = {
  id: string;
  content: string | null;
  mediaUrls: string[];
  isSubscriberOnly: boolean;
  locked: boolean;
  lockReason: PostLockReason | null;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl: string; profileType: ProfileType };
};

function toMediaUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toPostView(
  post: RawPost,
  hasSubscriberAccess: boolean,
  premiumProviderLocked = false
): PostView {
  const lockReason = post.isSubscriberOnly && !hasSubscriberAccess
    ? "subscriber_only"
    : premiumProviderLocked
      ? "premium_provider_limit"
      : null;
  const locked = lockReason !== null;

  return {
    id: post.id,
    isSubscriberOnly: post.isSubscriberOnly,
    createdAt: post.createdAt.toISOString(),
    locked,
    lockReason,
    content: locked ? null : post.content,
    mediaUrls: locked ? [] : toMediaUrls(post.mediaUrls),
    author: post.author,
  };
}

type ProviderContentContext =
  | { viewerProfileId: string | null; isPremium: true }
  | {
      viewerProfileId: string | null;
      isPremium: false;
      viewedPostIds: Set<string>;
      limit: number;
    };

async function getProviderContentContext(viewerProfileId: string | null): Promise<ProviderContentContext> {
  if (!viewerProfileId) {
    return {
      viewerProfileId,
      isPremium: false,
      viewedPostIds: new Set<string>(),
      limit: FREE_DAILY_PROVIDER_POST_LIMIT,
    };
  }

  if (await isPremiumUser(viewerProfileId)) {
    return { viewerProfileId, isPremium: true };
  }

  const usage = await getDailyProviderPostUsage(viewerProfileId);
  return {
    viewerProfileId,
    isPremium: false,
    viewedPostIds: usage.viewedPostIds,
    limit: usage.limit,
  };
}

async function applyProviderContentLimits(
  posts: RawPost[],
  viewerProfileId: string | null,
  hasSubscriberAccess: (post: RawPost) => boolean
): Promise<PostView[]> {
  const context = await getProviderContentContext(viewerProfileId);
  const recordTasks: Promise<void>[] = [];
  let anonymousFreeViews = 0;

  const views = posts.map((post) => {
    let premiumProviderLocked = false;
    const isOwnPost = post.author.id === viewerProfileId;
    const isFreeProviderPost =
      !post.isSubscriberOnly && !isOwnPost && isProviderProfileType(post.author.profileType);

    if (isFreeProviderPost && !context.isPremium) {
      const alreadyViewed = context.viewedPostIds.has(post.id);
      if (!alreadyViewed && context.viewedPostIds.size >= context.limit) {
        premiumProviderLocked = true;
      } else if (!alreadyViewed) {
        context.viewedPostIds.add(post.id);
        if (context.viewerProfileId) {
          recordTasks.push(recordProviderPostView(post.author.id, context.viewerProfileId, post.id));
        } else {
          anonymousFreeViews += 1;
          if (anonymousFreeViews > context.limit) premiumProviderLocked = true;
        }
      }
    }

    return toPostView(post, hasSubscriberAccess(post), premiumProviderLocked);
  });

  await Promise.allSettled(recordTasks);
  return views;
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

  return applyProviderContentLimits(posts, viewerProfileId, () => hasSubscriberAccess);
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

  return applyProviderContentLimits(
    posts,
    viewerProfileId,
    (post) => post.author.id === viewerProfileId || subscribedCreatorIds.has(post.author.id)
  );
}
