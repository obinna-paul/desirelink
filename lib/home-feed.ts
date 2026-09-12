import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MEET_RADIUS_KM = 50;

export function profileCardSelect() {
  return {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    bannerUrl: true,
    city: true,
    country: true,
    showExactLocation: true,
    profileType: true,
    serviceCategories: true,
    isVerified: true,
    isVerifiedCreator: true,
    isVerifiedServiceProvider: true,
    verificationPending: true,
    isTrustedMember: true,
    availabilityStatuses: {
      where: { expiresAt: { gt: new Date() } },
      select: { status: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  } satisfies Prisma.ProfileSelect;
}

export type ProfileCardData = Prisma.ProfileGetPayload<{ select: ReturnType<typeof profileCardSelect> }> & {
  distanceKm?: number;
};

type ViewerProfile = {
  id: string;
  locationLat: number;
  locationLng: number;
};

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function excludeSelf(viewerProfile: ViewerProfile | null): Prisma.ProfileWhereInput {
  return viewerProfile ? { NOT: { id: viewerProfile.id } } : {};
}

// (0, 0) is the sentinel for "location never set" - a real GPS reading landing exactly
// on Null Island is practically impossible, so treating it as "no location" is safe.
function hasCoordinates(lat: number, lng: number): boolean {
  return lat !== 0 || lng !== 0;
}

function hasLocation(viewerProfile: ViewerProfile | null): viewerProfile is ViewerProfile {
  return Boolean(viewerProfile && hasCoordinates(viewerProfile.locationLat, viewerProfile.locationLng));
}

export type HomeFeedResult = {
  profiles: ProfileCardData[];
  note?: string;
};

export async function getHomeFeed(
  tab: string,
  viewerProfile: ViewerProfile | null
): Promise<HomeFeedResult> {
  const visible: Prisma.ProfileWhereInput = { isIncognito: false };
  const notSelf = excludeSelf(viewerProfile);

  switch (tab) {
    case "chat": {
      const profiles = await prisma.profile.findMany({
        where: { ...visible, ...notSelf, openToChat: true },
        select: profileCardSelect(),
        orderBy: { updatedAt: "desc" },
        take: 24,
      });
      return { profiles };
    }

    case "meet": {
      if (!hasLocation(viewerProfile)) {
        const profiles = await prisma.profile.findMany({
          where: { ...visible, ...notSelf, openToMeet: true },
          select: profileCardSelect(),
          orderBy: { updatedAt: "desc" },
          take: 24,
        });
        return {
          profiles,
          note: "Set your location on your profile to see who's within 50km.",
        };
      }

      const candidates = await prisma.profile.findMany({
        where: { ...visible, ...notSelf, openToMeet: true },
        select: { ...profileCardSelect(), locationLat: true, locationLng: true },
        take: 200,
      });

      const withinRadius = candidates
        // A candidate who never set their own location can't meaningfully be placed on
        // a map - without this, they'd default to (0, 0) and either show a fake distance
        // or accidentally read as "nearby" to a viewer who happens to be near Null Island.
        .filter((candidate) => hasCoordinates(candidate.locationLat, candidate.locationLng))
        .map((candidate) => ({
          candidate,
          distanceKm: haversineDistanceKm(
            viewerProfile.locationLat,
            viewerProfile.locationLng,
            candidate.locationLat,
            candidate.locationLng
          ),
        }))
        .filter(({ distanceKm }) => distanceKm <= MEET_RADIUS_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 24)
        .map(({ candidate, distanceKm }) => ({ ...candidate, distanceKm }));

      return { profiles: withinRadius };
    }

    case "creators": {
      const profiles = await prisma.profile.findMany({
        where: { ...visible, ...notSelf, profileType: "CREATOR" },
        select: profileCardSelect(),
        orderBy: { updatedAt: "desc" },
        take: 24,
      });
      return { profiles };
    }

    case "couples": {
      const profiles = await prisma.profile.findMany({
        where: { ...visible, ...notSelf, partnerId: { not: null } },
        select: profileCardSelect(),
        orderBy: { updatedAt: "desc" },
        take: 24,
      });
      return { profiles };
    }

    case "explore": {
      const profiles = await prisma.profile.findMany({
        where: { ...visible, ...notSelf },
        select: profileCardSelect(),
        orderBy: { createdAt: "desc" },
        take: 24,
      });
      return { profiles, note: "Fresh faces: the newest members to join udala." };
    }

    case "browse":
    default: {
      const profiles = await prisma.profile.findMany({
        where: { ...visible, ...notSelf },
        select: profileCardSelect(),
        orderBy: [{ communityStanding: "desc" }, { createdAt: "desc" }],
        take: 24,
      });
      return { profiles };
    }
  }
}

