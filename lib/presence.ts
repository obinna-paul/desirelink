import "server-only";

import { prisma } from "@/lib/prisma";

/** How long since lastActiveAt still counts as "online" for presence rings across the app
 * (feed, profile, comments, the home ring row). Kept separate from the tighter 2-minute
 * window app/api/messages/presence/route.ts uses for the in-chat presence dot - that's a
 * different, more time-sensitive signal. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export type PresenceStatus = "offline" | "online" | "live";

type PresenceSource = {
  lastActiveAt: Date | null;
  showActivityStatus: boolean;
};

/**
 * A profile's online/last-active state is only visible to other people when they've opted
 * in via showActivityStatus (same rule the messages presence endpoint enforces) - otherwise
 * everyone but the profile's own owner sees "offline" regardless of real activity. Going
 * live is a public broadcast, not passive activity, so it's never hidden by that toggle.
 */
export function getPresenceStatus(profile: PresenceSource, isLive: boolean): PresenceStatus {
  if (isLive) return "live";
  if (!profile.showActivityStatus || !profile.lastActiveAt) return "offline";
  return profile.lastActiveAt.getTime() > Date.now() - ONLINE_WINDOW_MS ? "online" : "offline";
}

/** A profile viewing its own presence always sees its true status, since the privacy
 * toggle only controls what OTHER people see. */
export function getOwnPresenceStatus(profile: { lastActiveAt: Date | null }): PresenceStatus {
  if (!profile.lastActiveAt) return "offline";
  return profile.lastActiveAt.getTime() > Date.now() - ONLINE_WINDOW_MS ? "online" : "offline";
}

/** Batched live-stream lookup for a list of profile ids - avoids an N+1 query when rendering
 * presence rings for many authors at once (a feed page, a comment thread). */
export async function getLiveProfileIds(profileIds: string[]): Promise<Set<string>> {
  return new Set((await getLiveStreamIdsByProvider(profileIds)).keys());
}

/** Same batching as getLiveProfileIds, but also returns each live provider's stream id so
 * callers can link a live ring straight to the stream, not just flag it as live. */
export async function getLiveStreamIdsByProvider(profileIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(profileIds));
  if (uniqueIds.length === 0) return new Map();

  const rows = await prisma.liveStream.findMany({
    where: { status: "live", providerId: { in: uniqueIds } },
    select: { providerId: true, id: true },
  });
  return new Map(rows.map((row) => [row.providerId, row.id]));
}
