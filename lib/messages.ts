import { prisma } from "@/lib/prisma";
import { triggerEvent } from "@/lib/pusher-server";
import { isBlockedEitherWay } from "@/lib/block";
import { flagContentIfNeeded } from "@/lib/moderation";
import { createNotification } from "@/lib/notifications";
import {
  getConversationChannelName,
  getUserChannelName,
  INBOX_UPDATED_EVENT,
  MESSAGES_READ_EVENT,
  NEW_MESSAGE_EVENT,
} from "@/lib/message-channels";
import type {
  ConversationMessage,
  ConversationParticipant,
  ConversationSummary,
} from "@/lib/message-types";
import { Prisma } from "@prisma/client";

export {
  CONNECTION_REASONS,
  isConnectionReasonValue,
  type ConnectionReasonValue,
  type ConversationMessage,
  type ConversationParticipant,
  type ConversationSummary,
} from "@/lib/message-types";

const MAX_MESSAGE_LENGTH = 2000;

const counterpartSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  profileType: true,
} as const;

const CONVERSATION_HISTORY_SCAN_LIMIT = 500;

function isMissingReplySchema(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

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

/** Full message history between two profiles, oldest first. Marks the viewer's unread messages as read as a side effect. */
export async function getConversation(
  profileId: string,
  counterpartId: string
): Promise<ConversationMessage[]> {
  const where = {
    OR: [
      { senderId: profileId, recipientId: counterpartId },
      { senderId: counterpartId, recipientId: profileId },
    ],
  };
  let messages: ConversationMessage[];
  try {
    messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        replyTo: { select: { id: true, content: true, senderId: true } },
      },
    });
  } catch (error) {
    if (!isMissingReplySchema(error)) throw error;
    const legacyMessages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        readAt: true,
        senderId: true,
        recipientId: true,
      },
    });
    messages = legacyMessages.map((message) => ({ ...message, replyToId: null, replyTo: null }));
  }

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
  content: string,
  replyToId?: string | null
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

  const sender = await prisma.profile.findUnique({ where: { id: senderId }, select: { isSuspended: true } });
  if (!sender || sender.isSuspended) {
    return { ok: false, status: 403, error: "Your account is suspended from messaging" };
  }

  const recipient = await prisma.profile.findUnique({ where: { id: recipientId }, select: { id: true } });
  if (!recipient) {
    return { ok: false, status: 404, error: "Recipient not found" };
  }

  if (await isBlockedEitherWay(senderId, recipientId)) {
    return { ok: false, status: 403, error: "You can't message this user" };
  }

  let validReplyToId: string | null = null;
  if (replyToId) {
    const repliedMessage = await prisma.message.findFirst({
      where: {
        id: replyToId,
        OR: [
          { senderId, recipientId },
          { senderId: recipientId, recipientId: senderId },
        ],
      },
      select: { id: true },
    });
    if (!repliedMessage) {
      return { ok: false, status: 400, error: "That message is not part of this conversation" };
    }
    validReplyToId = repliedMessage.id;
  }

  let message: ConversationMessage & { sender: ConversationParticipant };
  try {
    message = await prisma.message.create({
      data: {
        senderId,
        recipientId,
        content: trimmed,
        ...(validReplyToId ? { replyToId: validReplyToId } : {}),
      },
      include: {
        sender: { select: counterpartSelect },
        replyTo: { select: { id: true, content: true, senderId: true } },
      },
    });
  } catch (error) {
    if (!isMissingReplySchema(error)) throw error;
    if (validReplyToId) {
      return { ok: false, status: 503, error: "Replies are being enabled. Send this as a new message for now." };
    }
    const legacyMessage = await prisma.message.create({
      data: { senderId, recipientId, content: trimmed },
      select: {
        id: true,
        content: true,
        createdAt: true,
        readAt: true,
        senderId: true,
        recipientId: true,
        sender: { select: counterpartSelect },
      },
    });
    message = { ...legacyMessage, replyToId: null, replyTo: null };
  }
  await flagContentIfNeeded({
    contentType: "message",
    contentId: message.id,
    contentOwnerId: senderId,
    content: message.content,
  });

  await Promise.all([
    triggerEvent(getConversationChannelName(senderId, recipientId), NEW_MESSAGE_EVENT, message),
    triggerEvent(getUserChannelName(recipientId), INBOX_UPDATED_EVENT, { fromProfileId: senderId }),
    createNotification({
      recipientId,
      actorId: senderId,
      type: "message",
      title: `New message from ${message.sender.displayName}`,
      body: message.content.length > 90 ? `${message.content.slice(0, 87)}...` : message.content,
      href: `/messages?with=${message.sender.username}`,
    }),
  ]);

  return { ok: true, message };
}
