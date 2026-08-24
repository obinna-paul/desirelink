import { prisma } from "@/lib/prisma";
import { triggerEvent } from "@/lib/pusher-server";
import {
  chatChannelName,
  GROUP_MESSAGE_DELETED_EVENT,
  NEW_GROUP_MESSAGE_EVENT,
  USER_MUTED_EVENT,
  USER_UNMUTED_EVENT,
  type ChannelType,
} from "@/lib/group-chat-channels";
import { flagContentIfNeeded } from "@/lib/moderation";

export type { ChannelType } from "@/lib/group-chat-channels";

const MAX_MESSAGE_LENGTH = 1000;

const senderSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export async function getGroupMessages(channelType: ChannelType, channelId: string, limit = 100) {
  return prisma.groupMessage.findMany({
    where: { channelType, channelId },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { sender: { select: senderSelect } },
  });
}

export type GroupMessageData = Awaited<ReturnType<typeof getGroupMessages>>[number];

export async function isUserMuted(
  channelType: ChannelType,
  channelId: string,
  userId: string
): Promise<boolean> {
  const mute = await prisma.groupChatMute.findUnique({
    where: { channelType_channelId_userId: { channelType, channelId, userId } },
  });
  return Boolean(mute);
}

export async function getMutedUserIds(channelType: ChannelType, channelId: string): Promise<string[]> {
  const mutes = await prisma.groupChatMute.findMany({
    where: { channelType, channelId },
    select: { userId: true },
  });
  return mutes.map((mute) => mute.userId);
}

export type SendGroupMessageResult =
  | { ok: true; message: GroupMessageData }
  | { ok: false; status: number; error: string };

export async function sendGroupMessage(
  channelType: ChannelType,
  channelId: string,
  senderId: string,
  content: string
): Promise<SendGroupMessageResult> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, status: 400, error: "Message can't be empty" };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, status: 400, error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` };
  }

  const sender = await prisma.profile.findUnique({ where: { id: senderId }, select: { isSuspended: true } });
  if (!sender || sender.isSuspended) {
    return { ok: false, status: 403, error: "Your account is suspended from chatting" };
  }

  if (await isUserMuted(channelType, channelId, senderId)) {
    return { ok: false, status: 403, error: "You've been muted in this chat" };
  }

  const message = await prisma.groupMessage.create({
    data: { channelType, channelId, senderId, content: trimmed },
    include: { sender: { select: senderSelect } },
  });
  await flagContentIfNeeded({
    contentType: "group_message",
    contentId: message.id,
    contentOwnerId: senderId,
    content: message.content,
  });

  await triggerEvent(chatChannelName(channelType, channelId), NEW_GROUP_MESSAGE_EVENT, message);

  return { ok: true, message };
}

export type ChatModerationResult = { ok: true } | { ok: false; status: number; error: string };

export async function deleteGroupMessage(
  channelType: ChannelType,
  channelId: string,
  messageId: string
): Promise<ChatModerationResult> {
  const message = await prisma.groupMessage.findUnique({ where: { id: messageId } });
  if (!message || message.channelType !== channelType || message.channelId !== channelId) {
    return { ok: false, status: 404, error: "Message not found" };
  }

  await prisma.groupMessage.delete({ where: { id: messageId } });
  await triggerEvent(chatChannelName(channelType, channelId), GROUP_MESSAGE_DELETED_EVENT, { messageId });

  return { ok: true };
}

export async function muteUser(
  channelType: ChannelType,
  channelId: string,
  userId: string,
  mutedById: string
): Promise<ChatModerationResult> {
  if (userId === mutedById) {
    return { ok: false, status: 400, error: "You can't mute yourself" };
  }

  await prisma.groupChatMute.upsert({
    where: { channelType_channelId_userId: { channelType, channelId, userId } },
    create: { channelType, channelId, userId, mutedById },
    update: {},
  });
  await triggerEvent(chatChannelName(channelType, channelId), USER_MUTED_EVENT, { userId });

  return { ok: true };
}

export async function unmuteUser(
  channelType: ChannelType,
  channelId: string,
  userId: string
): Promise<ChatModerationResult> {
  await prisma.groupChatMute.deleteMany({ where: { channelType, channelId, userId } });
  await triggerEvent(chatChannelName(channelType, channelId), USER_UNMUTED_EVENT, { userId });

  return { ok: true };
}
