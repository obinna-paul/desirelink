import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const HOME_TABS = [
  { value: "browse", label: "Browse" },
  { value: "chat", label: "Chat" },
  { value: "flirt", label: "Flirt" },
  { value: "meet", label: "Meet" },
  { value: "events", label: "Events" },
  { value: "creators", label: "Creators" },
  { value: "couples", label: "Couples" },
  { value: "explore", label: "Explore" },
] as const;

export type HomeTabValue = (typeof HOME_TABS)[number]["value"];

export const DEFAULT_HOME_TAB: HomeTabValue = "browse";

export function isHomeTabValue(value: string | undefined): value is HomeTabValue {
  return HOME_TABS.some((tab) => tab.value === value);
}

const MEET_RADIUS_KM = 50;

export function profileCardSelect() {
  return {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    city: true,
    country: true,
    isCreator: true,
    isCouple: true,
    desires: {
      where: { privacy: "public" },
      select: { id: true, category: true },
      take: 4,
    },
    availabilityStatuses: {
      where: { expiresAt: { gt: new Date() } },
      select: { status: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  } satisfies Prisma.ProfileSelect;
}

export type ProfileCardData = Prisma.ProfileGetPayload<{ select: ReturnType<typeof profileCardSelect> }>;

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
  tab: HomeTabValue,
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

    case "flirt": {
      const profiles = await prisma.profile.findMany({
        where: {
          ...visible,
          ...notSelf,
          openToChat: true,
          desires: { some: { category: "Flirting" } },
        },
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
        .map(({ candidate }) => candidate);

      return { profiles: withinRadius };
    }

    case "creators": {
      const profiles = await prisma.profile.findMany({
        where: { ...visible, ...notSelf, isCreator: true },
        select: profileCardSelect(),
        orderBy: { updatedAt: "desc" },
        take: 24,
      });
      return { profiles };
    }

    case "couples": {
      const profiles = await prisma.profile.findMany({
        where: { ...visible, ...notSelf, isCouple: true },
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
      return { profiles, note: "Fresh faces: the newest members to join DesireLink." };
    }

    case "events":
      return { profiles: [] };

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
