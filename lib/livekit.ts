import "server-only";

import { AccessToken, type VideoGrant } from "livekit-server-sdk";

const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

export function isLiveKitConfigured(): boolean {
  return Boolean(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL);
}

if (!isLiveKitConfigured()) {
  // eslint-disable-next-line no-console
  console.warn(
    "[livekit] LIVEKIT_API_KEY/LIVEKIT_API_SECRET/LIVEKIT_URL are not fully set — live streaming is disabled."
  );
}

export function getLiveKitUrl(): string {
  if (!LIVEKIT_URL) throw new Error("LIVEKIT_URL is not set.");
  return LIVEKIT_URL;
}

/**
 * Mints a room-scoped access token. Hosts get publish+subscribe; viewers get
 * subscribe-only plus data-channel publish, so they can send live chat
 * messages without being able to publish audio/video into the room.
 */
export async function createLiveKitToken(options: {
  roomName: string;
  identity: string;
  name: string;
  canPublish: boolean;
}): Promise<string> {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("LiveKit is not configured.");
  }

  const grant: VideoGrant = {
    room: options.roomName,
    roomJoin: true,
    canPublish: options.canPublish,
    canPublishData: true,
    canSubscribe: true,
  };

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: options.identity,
    name: options.name,
  });
  token.addGrant(grant);
  return token.toJwt();
}
