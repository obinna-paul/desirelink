import { prisma } from "@/lib/prisma";

export const EVENT_TYPE_OPTIONS = [
  "Social",
  "Party",
  "Meetup",
  "Orgy",
  "Threesome",
  "Swinging",
  "Foursome",
  "Other",
] as const;

export type EventTypeValue = (typeof EVENT_TYPE_OPTIONS)[number];

export async function getHostEvents(profileId: string) {
  return prisma.event.findMany({
    where: { hostId: profileId },
    orderBy: { startTime: "desc" },
  });
}

export async function getEventForEdit(eventId: string, hostProfileId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.hostId !== hostProfileId) return null;
  return event;
}

export async function getUpcomingEvents(limit = 30) {
  return prisma.event.findMany({
    where: { isPrivate: false, endTime: { gt: new Date() } },
    orderBy: { startTime: "asc" },
    take: limit,
    include: {
      host: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
}

export type UpcomingEvent = Awaited<ReturnType<typeof getUpcomingEvents>>[number];
