/**
 * Pure channel-naming/event helpers shared between the server (lib/live-streams.ts,
 * the pusher auth route) and the client (live stream components) — no
 * server-only imports here, so this file is safe to pull into "use client"
 * components.
 */

export function liveStreamChannelName(streamId: string): string {
  return `presence-live-${streamId}`;
}

export const LIVE_CHAT_MESSAGE_EVENT = "chat-message";
export const LIVE_GIFT_SENT_EVENT = "gift-sent";
export const LIVE_STREAM_ENDED_EVENT = "stream-ended";
