import type { ProfileType } from "@prisma/client";

export const CONNECTION_REASONS = [
  {
    value: "shared_interest",
    label: "Shared interest",
    template: "Hey! Looks like we're into some of the same things 👀",
  },
  {
    value: "same_city",
    label: "Same city",
    template: "Hey! Noticed we're in the same city — small world.",
  },
  {
    value: "creator_fan",
    label: "Creator/Fan",
    template: "Hi! I'm a fan of your content and wanted to say hello.",
  },
  {
    value: "compliment",
    label: "Compliment",
    template: "Not gonna lie, your profile stopped my scroll 😏",
  },
  {
    value: "flirty",
    label: "Flirty",
    template: "Okay I have to ask... are you as much trouble as you look? 😉",
  },
  {
    value: "straight_up",
    label: "Straight up",
    template: "You're exactly my type. Tell me something about you?",
  },
  {
    value: "curious",
    label: "Curious",
    template: "What's something you're really into that most people don't know about you?",
  },
  {
    value: "playful",
    label: "Playful",
    template: "Be honest — are you as much fun as your photos make you look?",
  },
  {
    value: "spicy",
    label: "Spicy",
    template: "I'll admit, I've got a few things on my mind after seeing your photos 😏",
  },
  {
    value: "confident",
    label: "Confident",
    template: "Hey gorgeous, mind if I steal a little of your time?",
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
