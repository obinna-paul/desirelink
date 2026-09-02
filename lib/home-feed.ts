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

function hasLocation(viewerProfile: ViewerProfile | null): viewerProfile is ViewerProfile {
  return Boolean(viewerProfile && (viewerProfile.locationLat !== 0 || viewerProfile.locationLng !== 0));
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

export async function searchProfiles(
  query: string,
  viewerProfile: ViewerProfile | null
): Promise<ProfileCardData[]> {
  const notSelf = excludeSelf(viewerProfile);

  return prisma.profile.findMany({
    where: {
      isIncognito: false,
      showInSearch: true,
      ...notSelf,
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: profileCardSelect(),
    orderBy: { displayName: "asc" },
    take: 24,
  });
}
