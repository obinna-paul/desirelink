import type { ProfileType } from "@prisma/client";
import {
  isMessageOpenerCategoryId,
  MESSAGE_OPENER_CATEGORIES,
  type MessageOpenerCategoryId,
} from "@/lib/message-openers";

export const CONNECTION_REASONS = MESSAGE_OPENER_CATEGORIES;

export type ConnectionReasonValue = MessageOpenerCategoryId;

export function isConnectionReasonValue(value: unknown): value is ConnectionReasonValue {
  return isMessageOpenerCategoryId(value);
}

export type ConversationParticipant = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  profileType: ProfileType;
  isVerified: boolean;
  isVerifiedCreator: boolean;
  isVerifiedServiceProvider: boolean;
  verificationPending: boolean;
};

export type ConversationSummary = {
  counterpart: ConversationParticipant;
  lastMessage: { content: string; createdAt: Date; isMine: boolean };
  unreadCount: number;
};

export type ConversationMediaType = "image" | "video" | "audio";

export type ConversationMedia = {
  url: string;
  type: ConversationMediaType;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

export type ConversationMessage = {
  id: string;
  content: string;
  createdAt: Date;
  readAt: Date | null;
  senderId: string;
  recipientId: string;
  replyToId: string | null;
  replyTo: { id: string; content: string; senderId: string; mediaType: ConversationMediaType | null } | null;
  mediaUrl: string | null;
  mediaType: ConversationMediaType | null;
  mediaMimeType: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  mediaDurationSeconds: number | null;
};
