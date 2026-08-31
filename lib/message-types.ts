import type { ProfileType } from "@prisma/client";

export const CONNECTION_REASONS = [
  {
    value: "shared_interest",
    label: "Shared interest",
    template: "Hi! I noticed we're both into similar things on udala.",
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

export type ConversationParticipant = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  profileType: ProfileType;
};

export type ConversationSummary = {
  counterpart: ConversationParticipant;
  lastMessage: { content: string; createdAt: Date; isMine: boolean };
  unreadCount: number;
};

export type ConversationMessage = {
  id: string;
  content: string;
  createdAt: Date;
  readAt: Date | null;
  senderId: string;
  recipientId: string;
  replyToId: string | null;
  replyTo: { id: string; content: string; senderId: string } | null;
};
