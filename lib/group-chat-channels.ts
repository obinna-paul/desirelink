/**
 * Pure channel-naming helpers shared between the server (lib/group-chat.ts,
 * the pusher auth route) and the client (chat components) — no server-only
 * imports here, so this file is safe to pull into "use client" components.
 */

export type ChannelType = "room" | "event";

export function chatChannelName(channelType: ChannelType, channelId: string): string {
  return `presence-${channelType}-${channelId}`;
}

export const NEW_GROUP_MESSAGE_EVENT = "new-message";
export const GROUP_MESSAGE_DELETED_EVENT = "message-deleted";
export const USER_MUTED_EVENT = "user-muted";
export const USER_UNMUTED_EVENT = "user-unmuted";
