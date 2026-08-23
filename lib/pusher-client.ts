import PusherClient from "pusher-js";

export const AVAILABILITY_CHANNEL = "presence-availability";
export const AVAILABILITY_STATUS_UPDATED_EVENT = "status-updated";
export const AVAILABILITY_STATUS_CLEARED_EVENT = "status-cleared";

let cachedClient: PusherClient | null | undefined;

export function getPusherClient(): PusherClient | null {
  if (typeof window === "undefined") return null;
  if (cachedClient !== undefined) return cachedClient;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = new PusherClient(key, {
    cluster,
    authEndpoint: "/api/pusher/auth",
  });

  return cachedClient;
}
