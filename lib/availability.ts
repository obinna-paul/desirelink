import type { AvailabilityStatusType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { haversineDistanceKm } from "@/lib/home-feed";
import { ONLINE_WINDOW_MS } from "@/lib/presence";

export const NEARBY_ACTIVE_RADIUS_KM = 50;

export type AvailabilityFeedItem = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  status: AvailabilityStatusType;
  expiresAt: string;
};

export type ActiveAvailability = {
  status: AvailabilityStatusType;
  expiresAt: string;
} | null;

export type NearbyActiveSnapshot = {
  locationReady: boolean;
  onlineCount: number;
  radiusKm: number;
  items: AvailabilityFeedItem[];
};

type NearbyViewer = {
  id: string;
  locationLat: number;
  locationLng: number;
};

function hasUsableLocation(viewer: NearbyViewer): boolean {
  return viewer.locationLat !== 0 || viewer.locationLng !== 0;
}

/** A privacy-aware snapshot for the desktop rail. Availability is optional: every
 * nearby online profile contributes to the count, while only people who deliberately
 * shared an availability note appear in the list. */
export async function getNearbyActiveSnapshot(
  viewer: NearbyViewer,
  limit = 20,
): Promise<NearbyActiveSnapshot> {
  if (!hasUsableLocation(viewer)) {
    return { locationReady: false, onlineCount: 0, radiusKm: NEARBY_ACTIVE_RADIUS_KM, items: [] };
  }

  const now = new Date();
  const candidates = await prisma.profile.findMany({
    where: {
      id: { not: viewer.id },
      isIncognito: false,
      isSuspended: false,
      showInSearch: true,
      showActivityStatus: true,
      lastActiveAt: { gte: new Date(now.getTime() - ONLINE_WINDOW_MS) },
      OR: [{ locationLat: { not: 0 } }, { locationLng: { not: 0 } }],
      blocksReceived: { none: { blockerId: viewer.id } },
      blocksMade: { none: { blockedId: viewer.id } },
    },
    orderBy: { lastActiveAt: "desc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      locationLat: true,
      locationLng: true,
      availabilityStatuses: {
        where: { expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, expiresAt: true },
      },
    },
  });

  const nearby = candidates.filter(
    (candidate) =>
      haversineDistanceKm(
        viewer.locationLat,
        viewer.locationLng,
        candidate.locationLat,
        candidate.locationLng,
      ) <= NEARBY_ACTIVE_RADIUS_KM,
  );

  const items = nearby
    .flatMap((profile) => {
      const availability = profile.availabilityStatuses[0];
      return availability
        ? [
            {
              id: profile.id,
              username: profile.username,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              status: availability.status,
              expiresAt: availability.expiresAt.toISOString(),
            },
          ]
        : [];
    })
    .slice(0, limit);

  return {
    locationReady: true,
    onlineCount: nearby.length,
    radiusKm: NEARBY_ACTIVE_RADIUS_KM,
    items,
  };
}

export async function getActiveAvailability(profileId: string): Promise<ActiveAvailability> {
  const row = await prisma.availabilityStatus.findFirst({
    where: { userId: profileId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { status: true, expiresAt: true },
  });

  return row ? { status: row.status, expiresAt: row.expiresAt.toISOString() } : null;
}

async function queryAvailabilityFeed(
  status: AvailabilityStatusType | undefined,
  limit: number,
  excludeProfileId?: string
): Promise<AvailabilityFeedItem[]> {
  const rows = await prisma.availabilityStatus.findMany({
    where: {
      ...(status ? { status } : {}),
      expiresAt: { gt: new Date() },
      profile: { isIncognito: false },
      ...(excludeProfileId ? { NOT: { userId: excludeProfileId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      status: true,
      expiresAt: true,
      profile: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.profile.id,
    username: row.profile.username,
    displayName: row.profile.displayName,
    avatarUrl: row.profile.avatarUrl,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
  }));
}

export function getAvailableNow(limit = 20, excludeProfileId?: string): Promise<AvailabilityFeedItem[]> {
  return queryAvailabilityFeed(undefined, limit, excludeProfileId);
}

export function getAvailableTonight(
  limit = 20,
  excludeProfileId?: string
): Promise<AvailabilityFeedItem[]> {
  return queryAvailabilityFeed("available_tonight", limit, excludeProfileId);
}
