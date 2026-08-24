import type { ModerationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { triggerEvent } from "@/lib/pusher-server";
import { chatChannelName } from "@/lib/group-chat-channels";
import { GROUP_MESSAGE_DELETED_EVENT } from "@/lib/group-chat-channels";

export const MODERATION_KEYWORDS = [
  "scam",
  "blackmail",
  "extortion",
  "underage",
  "minor",
  "chargeback",
  "wire transfer",
  "western union",
  "off platform payment",
  "pay outside",
  "threaten",
] as const;

const MODERATION_PATTERNS = [
  { label: "Repeated payment request", pattern: /\b(cashapp|venmo|paypal|zelle)\b/i },
  { label: "External contact pressure", pattern: /\b(text me|whatsapp|telegram|snapchat)\b/i },
] as const;

export type ModerationAction = "review" | "remove" | "warn" | "suspend";

export type ModerationContentType =
  | "profile"
  | "message"
  | "group_message"
  | "post"
  | "room_post"
  | "event";

export function scanForModerationIssues(content: string): string[] {
  const normalized = content.toLowerCase();
  const keywordMatches = MODERATION_KEYWORDS.filter((keyword) => normalized.includes(keyword));
  const patternMatches = MODERATION_PATTERNS.filter((entry) => entry.pattern.test(content)).map(
    (entry) => entry.label
  );

  return Array.from(new Set([...keywordMatches.map((keyword) => `Keyword: ${keyword}`), ...patternMatches]));
}

export async function queueModerationFlag({
  contentType,
  contentId,
  contentOwnerId,
  reporterId,
  reason,
  details,
}: {
  contentType: ModerationContentType;
  contentId: string;
  contentOwnerId?: string | null;
  reporterId?: string | null;
  reason: string;
  details: string;
}) {
  const existing = await prisma.moderationQueue.findFirst({
    where: {
      contentType,
      contentId,
      status: "pending",
      reason,
    },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.moderationQueue.create({
    data: {
      contentType,
      contentId,
      contentOwnerId,
      reporterId,
      reason,
      details,
      status: "pending",
    },
  });
}

export async function flagContentIfNeeded({
  contentType,
  contentId,
  contentOwnerId,
  content,
}: {
  contentType: ModerationContentType;
  contentId: string;
  contentOwnerId: string;
  content: string;
}) {
  const issues = scanForModerationIssues(content);
  if (issues.length === 0) return null;

  return queueModerationFlag({
    contentType,
    contentId,
    contentOwnerId,
    reason: "Automated keyword filter",
    details: issues.join(", "),
  });
}

async function getContentPreview(contentType: string, contentId: string) {
  switch (contentType) {
    case "profile": {
      const profile = await prisma.profile.findUnique({
        where: { id: contentId },
        select: { id: true, displayName: true, username: true, bio: true },
      });
      return profile
        ? { title: profile.displayName, body: profile.bio || `@${profile.username}`, ownerId: profile.id }
        : null;
    }
    case "message": {
      const message = await prisma.message.findUnique({
        where: { id: contentId },
        select: { content: true, senderId: true, sender: { select: { displayName: true, username: true } } },
      });
      return message
        ? { title: `Message from ${message.sender.displayName}`, body: message.content, ownerId: message.senderId }
        : null;
    }
    case "group_message": {
      const message = await prisma.groupMessage.findUnique({
        where: { id: contentId },
        select: { content: true, senderId: true, sender: { select: { displayName: true, username: true } } },
      });
      return message
        ? { title: `Group message from ${message.sender.displayName}`, body: message.content, ownerId: message.senderId }
        : null;
    }
    case "post": {
      const post = await prisma.post.findUnique({
        where: { id: contentId },
        select: { content: true, authorId: true, author: { select: { displayName: true, username: true } } },
      });
      return post
        ? { title: `Post by ${post.author.displayName}`, body: post.content, ownerId: post.authorId }
        : null;
    }
    case "room_post": {
      const post = await prisma.roomPost.findUnique({
        where: { id: contentId },
        select: { content: true, authorId: true, author: { select: { displayName: true, username: true } } },
      });
      return post
        ? { title: `Room post by ${post.author.displayName}`, body: post.content, ownerId: post.authorId }
        : null;
    }
    case "event": {
      const event = await prisma.event.findUnique({
        where: { id: contentId },
        select: { title: true, description: true, hostId: true },
      });
      return event ? { title: event.title, body: event.description, ownerId: event.hostId } : null;
    }
    default:
      return null;
  }
}

export async function getModerationQueue(status: ModerationStatus = "pending") {
  const flags = await prisma.moderationQueue.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const ownerIds = flags.map((flag) => flag.contentOwnerId).filter((id): id is string => Boolean(id));
  const reporterIds = flags.map((flag) => flag.reporterId).filter((id): id is string => Boolean(id));
  const profileIds = Array.from(new Set([...ownerIds, ...reporterIds]));
  const profiles = await prisma.profile.findMany({
    where: { id: { in: profileIds } },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      warningCount: true,
      isSuspended: true,
    },
  });
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  const previews = await Promise.all(
    flags.map((flag) => getContentPreview(flag.contentType, flag.contentId))
  );

  return flags.map((flag, index) => ({
    ...flag,
    contentPreview: previews[index],
    owner: flag.contentOwnerId ? profilesById.get(flag.contentOwnerId) ?? null : null,
    reporter: flag.reporterId ? profilesById.get(flag.reporterId) ?? null : null,
  }));
}

export type ModerationQueueItem = Awaited<ReturnType<typeof getModerationQueue>>[number];

async function resolveOwnerId(contentType: string, contentId: string) {
  const preview = await getContentPreview(contentType, contentId);
  return preview?.ownerId ?? null;
}

async function removeContent(contentType: string, contentId: string) {
  switch (contentType) {
    case "message":
      await prisma.message.deleteMany({ where: { id: contentId } });
      return true;
    case "post":
      await prisma.post.deleteMany({ where: { id: contentId } });
      return true;
    case "room_post":
      await prisma.roomPost.deleteMany({ where: { id: contentId } });
      return true;
    case "group_message": {
      const message = await prisma.groupMessage.findUnique({
        where: { id: contentId },
        select: { channelType: true, channelId: true },
      });
      await prisma.groupMessage.deleteMany({ where: { id: contentId } });
      if (message) {
        await triggerEvent(chatChannelName(message.channelType, message.channelId), GROUP_MESSAGE_DELETED_EVENT, {
          messageId: contentId,
        });
      }
      return true;
    }
    case "event":
      await prisma.event.deleteMany({ where: { id: contentId } });
      return true;
    default:
      return false;
  }
}

export type ReviewModerationResult = { ok: true } | { ok: false; status: number; error: string };

export async function reviewModerationFlag(
  flagId: string,
  reviewerUserId: string,
  action: ModerationAction
): Promise<ReviewModerationResult> {
  const reviewer = await prisma.profile.findUnique({
    where: { userId: reviewerUserId },
    select: { id: true },
  });
  if (!reviewer) {
    return { ok: false, status: 404, error: "Reviewer profile not found" };
  }

  const flag = await prisma.moderationQueue.findUnique({ where: { id: flagId } });
  if (!flag) {
    return { ok: false, status: 404, error: "Moderation flag not found" };
  }
  if (flag.status !== "pending") {
    return { ok: false, status: 400, error: "This flag has already been reviewed" };
  }

  const ownerId = flag.contentOwnerId ?? (await resolveOwnerId(flag.contentType, flag.contentId));
  if ((action === "warn" || action === "suspend") && !ownerId) {
    return { ok: false, status: 400, error: "Could not resolve the content owner" };
  }

  if (action === "remove") {
    const removed = await removeContent(flag.contentType, flag.contentId);
    if (!removed) {
      return { ok: false, status: 400, error: "This content type can't be removed here" };
    }
  }

  if (action === "warn" && ownerId) {
    await prisma.profile.update({
      where: { id: ownerId },
      data: { warningCount: { increment: 1 }, communityStanding: { decrement: 5 } },
    });
  }

  if (action === "suspend" && ownerId) {
    await prisma.profile.update({
      where: { id: ownerId },
      data: { isSuspended: true, suspendedAt: new Date(), communityStanding: { decrement: 20 } },
    });
  }

  await prisma.moderationQueue.update({
    where: { id: flag.id },
    data: {
      status: action === "review" ? "reviewed" : "action_taken",
      action,
      reviewedById: reviewer.id,
      reviewedAt: new Date(),
      contentOwnerId: ownerId,
    },
  });

  if (flag.reporterId) {
    await prisma.report.updateMany({
      where: { targetType: flag.contentType as never, targetId: flag.contentId, status: "pending" },
      data: { status: action === "review" ? "reviewed" : "resolved" },
    });
  }

  return { ok: true };
}
