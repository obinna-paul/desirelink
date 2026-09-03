import "server-only";

import { prisma } from "@/lib/prisma";
import { toMediaItems } from "@/lib/posts";
import { recordAdminAction } from "@/lib/admin/audit";

/** Safe to show before the reason-for-access gate - no caption, no media. */
export async function getPostPreview(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      isSubscriberOnly: true,
      isArchived: true,
      createdAt: true,
      viewCount: true,
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
  return post;
}

export type PostPreview = NonNullable<Awaited<ReturnType<typeof getPostPreview>>>;

export const CONTENT_ACCESS_REASONS = [
  "Investigating a report",
  "Quality control review",
  "Verification review",
  "Legal or law-enforcement request",
  "Other",
] as const;
export type ContentAccessReason = (typeof CONTENT_ACCESS_REASONS)[number];

/** Recent paywalled posts platform-wide, newest first - the actual browse surface for
 * routine quality control (is premium content worth its price), as opposed to opening a
 * specific post you already know about from a report or an account record. */
export async function getRecentPremiumPosts(take = 30) {
  return prisma.post.findMany({
    where: { isSubscriberOnly: true, isArchived: false },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      createdAt: true,
      viewCount: true,
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { reactions: true, comments: true } },
    },
  });
}

export type RecentPremiumPost = Awaited<ReturnType<typeof getRecentPremiumPosts>>[number];

export type ViewLockedPostResult =
  | {
      ok: true;
      post: { id: string; content: string; media: ReturnType<typeof toMediaItems>; createdAt: Date };
    }
  | { ok: false; status: number; error: string };

/**
 * Bypasses the subscriber gate to fetch a paywalled post's real content - the compliance
 * gap this closes: without this, a reported premium post literally couldn't be reviewed.
 * Every call writes an audit row with the given reason BEFORE returning the content, since
 * the sensitive act here is the read itself, not some later decision.
 */
export async function viewLockedPost(
  postId: string,
  actorId: string,
  reason: string,
  detail?: string
): Promise<ViewLockedPostResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, content: true, mediaUrls: true, createdAt: true, author: { select: { username: true } } },
  });
  if (!post) {
    return { ok: false, status: 404, error: "Post not found" };
  }

  await recordAdminAction({
    actorId,
    action: "content.view_locked",
    targetType: "post",
    targetId: postId,
    summary: `Viewed locked post by @${post.author.username}: ${reason}${detail ? ` — ${detail}` : ""}`,
    metadata: { reason, detail: detail ?? null },
  });

  return {
    ok: true,
    post: {
      id: post.id,
      content: post.content,
      media: toMediaItems(post.mediaUrls),
      createdAt: post.createdAt,
    },
  };
}
