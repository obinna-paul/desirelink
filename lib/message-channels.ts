/**
 * Pure channel-naming helpers shared between the server (lib/messages.ts,
 * the pusher auth route) and the client (chat components) — no server-only
 * imports here, so this file is safe to pull into "use client" components.
 */

export function getConversationChannelName(profileIdA: string, profileIdB: string): string {
  const [a, b] = [profileIdA, profileIdB].sort();
  return `private-conversation-${a}-${b}`;
}

export function getUserChannelName(profileId: string): string {
  return `private-user-${profileId}`;
}

export const NEW_MESSAGE_EVENT = "new-message";
export const MESSAGES_READ_EVENT = "messages-read";
export const INBOX_UPDATED_EVENT = "inbox-updated";
