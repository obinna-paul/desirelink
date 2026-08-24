import { prisma } from "@/lib/prisma";
import { triggerEvent } from "@/lib/pusher-server";
import { isBlockedEitherWay } from "@/lib/block";
import {
  getConversationChannelName,
  getUserChannelName,
  INBOX_UPDATED_EVENT,
  MESSAGES_READ_EVENT,
  NEW_MESSAGE_EVENT,
} from "@/lib/message-channels";

export const CONNECTION_REASONS = [
  {
    value: "shared_interest",
    label: "Shared interest",
    template: "Hi! I noticed we're both into similar things on DesireLink.",
  },
  {
    value: "same_event",
    label: "Same event",
    template: "Hi! I saw we're both attending the same event.",
  },
  {
    value: "same_city",
    label: "Same city",
    template: "Hi! I noticed we're both in the same city.",
  },
  {
    value: "creator_fan",
    label: "Creator/Fan",
    template: "Hi! I'm a fan of your content and wanted to say hello.",
  },
  {
    value: "community",
    label: "Community",
    template: "Hi! We're part of the same community here and I wanted to connect.",
  },
] as const;

export type ConnectionReasonValue = (typeof CONNECTION_REASONS)[number]["value"];

export function isConnectionReasonValue(value: unknown): value is ConnectionReasonValue {
  return typeof value === "string" && CONNECTION_REASONS.some((reason) => reason.value === value);
}

const MAX_MESSAGE_LENGTH = 2000;

const counterpartSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export type ConversationParticipant = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
};

export type ConversationSummary = {
  counterpart: ConversationParticipant;
  lastMessage: { content: string; createdAt: Date; isMine: boolean };
  unreadCount: number;
};

const CONVERSATION_HISTORY_SCAN_LIMIT = 500;

/** Every conversation the profile is part of, newest first, with an unread count per thread. */
export async function getConversations(profileId: string): Promise<ConversationSummary[]> {
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: profileId }, { recipientId: profileId }] },
    orderBy: { createdAt: "desc" },
    take: CONVERSATION_HISTORY_SCAN_LIMIT,
    select: {
      content: true,
      createdAt: true,
      readAt: true,
      senderId: true,
      recipientId: true,
      sender: { select: counterpartSelect },
      recipient: { select: counterpartSelect },
    },
  });

  const byCounterpart = new Map<string, ConversationSummary>();

  for (const message of messages) {
    const isMine = message.senderId === profileId;
    const counterpart = isMine ? message.recipient : message.sender;

    let entry = byCounterpart.get(counterpart.id);
    if (!entry) {
      entry = {
        counterpart,
        lastMessage: { content: message.content, createdAt: message.createdAt, isMine },
        unreadCount: 0,
      };
      byCounterpart.set(counterpart.id, entry);
    }

    if (!isMine && !message.readAt) {
      entry.unreadCount += 1;
    }
  }

  return Array.from(byCounterpart.values());
}

export type ConversationMessage = {
  id: string;
  content: string;
  createdAt: Date;
  readAt: Date | null;
  senderId: string;
  recipientId: string;
};

/** Full message history between two profiles, oldest first. Marks the viewer's unread messages as read as a side effect. */
export async function getConversation(
  profileId: string,
  counterpartId: string
): Promise<ConversationMessage[]> {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: profileId, recipientId: counterpartId },
        { senderId: counterpartId, recipientId: profileId },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  const unreadIds = messages
    .filter((message) => message.recipientId === profileId && !message.readAt)
    .map((message) => message.id);

  if (unreadIds.length === 0) {
    return messages;
  }

  const readAt = new Date();
  await prisma.message.updateMany({ where: { id: { in: unreadIds } }, data: { readAt } });
  await triggerEvent(getConversationChannelName(profileId, counterpartId), MESSAGES_READ_EVENT, {
    readerId: profileId,
    readAt: readAt.toISOString(),
  });

  const unread = new Set(unreadIds);
  return messages.map((message) => (unread.has(message.id) ? { ...message, readAt } : message));
}

export type SendMessageResult =
  | { ok: true; message: ConversationMessage & { sender: ConversationParticipant } }
  | { ok: false; status: number; error: string };

export async function sendMessage(
  senderId: string,
  recipientId: string,
  content: string
): Promise<SendMessageResult> {
  if (senderId === recipientId) {
    return { ok: false, status: 400, error: "You can't message yourself" };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, status: 400, error: "Message can't be empty" };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, status: 400, error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` };
  }

  const recipient = await prisma.profile.findUnique({ where: { id: recipientId }, select: { id: true } });
  if (!recipient) {
    return { ok: false, status: 404, error: "Recipient not found" };
  }

  if (await isBlockedEitherWay(senderId, recipientId)) {
    return { ok: false, status: 403, error: "You can't message this user" };
  }

  const message = await prisma.message.create({
    data: { senderId, recipientId, content: trimmed },
    include: { sender: { select: counterpartSelect } },
  });

  await Promise.all([
    triggerEvent(getConversationChannelName(senderId, recipientId), NEW_MESSAGE_EVENT, message),
    triggerEvent(getUserChannelName(recipientId), INBOX_UPDATED_EVENT, { fromProfileId: senderId }),
  ]);

  return { ok: true, message };
}
