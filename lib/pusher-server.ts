import Pusher from "pusher";

export const AVAILABILITY_CHANNEL = "presence-availability";
export const AVAILABILITY_STATUS_UPDATED_EVENT = "status-updated";
export const AVAILABILITY_STATUS_CLEARED_EVENT = "status-cleared";

const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;

const isConfigured = Boolean(PUSHER_APP_ID && PUSHER_KEY && PUSHER_SECRET && PUSHER_CLUSTER);

if (!isConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "[pusher] PUSHER_APP_ID/PUSHER_KEY/PUSHER_SECRET/PUSHER_CLUSTER are not fully set — " +
      "real-time availability updates are disabled."
  );
}

export const pusherServer = isConfigured
  ? new Pusher({
      appId: PUSHER_APP_ID!,
      key: PUSHER_KEY!,
      secret: PUSHER_SECRET!,
      cluster: PUSHER_CLUSTER!,
      useTLS: true,
    })
  : null;

export async function triggerEvent(channel: string, event: string, data: unknown) {
  if (!pusherServer) return;
  try {
    await pusherServer.trigger(channel, event, data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[pusher] failed to trigger event", event, error);
  }
}

export async function triggerAvailabilityEvent(event: string, data: unknown) {
  await triggerEvent(AVAILABILITY_CHANNEL, event, data);
}
