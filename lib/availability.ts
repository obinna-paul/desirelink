import type { AvailabilityStatusType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
