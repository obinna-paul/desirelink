import { prisma } from "@/lib/prisma";
import { createEventCheckoutSession } from "@/lib/payments";
import { profileCardSelect, type ProfileCardData } from "@/lib/home-feed";

export const RSVP_ACTIONS = ["going", "interested", "not_going"] as const;
export type RsvpAction = (typeof RSVP_ACTIONS)[number];

export function isRsvpAction(value: unknown): value is RsvpAction {
  return typeof value === "string" && (RSVP_ACTIONS as readonly string[]).includes(value);
}

export async function getViewerRsvpStatus(eventId: string, viewerProfileId: string): Promise<RsvpAction | null> {
  const rsvp = await prisma.eventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId: viewerProfileId } },
    select: { status: true },
  });
  if (!rsvp) return null;
  return rsvp.status === "waitlist" ? null : (rsvp.status as RsvpAction);
}

export type EventAttendees = {
  profiles: ProfileCardData[];
  counts: { total: number; couples: number; singles: number; creators: number };
  hiddenByPrivacy: number;
  truncated: boolean;
};

const ATTENDEE_DISPLAY_LIMIT = 60;

/** Attendees visible to any viewer: "going" RSVPs from non-incognito profiles only. */
export async function getEventAttendees(eventId: string): Promise<EventAttendees> {
  const goingAny = { eventRsvps: { some: { eventId, status: "going" as const } } };
  const goingVisible = { ...goingAny, isIncognito: false };

  const [profiles, total, totalIncludingHidden, couples, creators] = await Promise.all([
    prisma.profile.findMany({
      where: goingVisible,
      select: profileCardSelect(),
      orderBy: { displayName: "asc" },
      take: ATTENDEE_DISPLAY_LIMIT,
    }),
    prisma.profile.count({ where: goingVisible }),
    prisma.profile.count({ where: goingAny }),
    prisma.profile.count({ where: { ...goingVisible, isCouple: true } }),
    prisma.profile.count({ where: { ...goingVisible, isCreator: true } }),
  ]);

  return {
    profiles,
    counts: { total, couples, singles: total - couples, creators },
    hiddenByPrivacy: totalIncludingHidden - total,
    truncated: total > profiles.length,
  };
}

export type RsvpResult =
  | { ok: true; state: "updated"; status: RsvpAction }
  | { ok: true; state: "checkout"; checkoutUrl: string }
  | { ok: false; status: number; error: string };

/**
 * Handles a click on Going / Interested / Can't Go. A priced event's first
 * "going" hands off to the payments service for a mock checkout instead of
 * updating the RSVP directly — the webhook flips it to "going" on success.
 * Leaving "going" (switching to interested/not_going) is free and immediate.
 */
export async function setRsvp(profileId: string, eventId: string, action: RsvpAction): Promise<RsvpResult> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return { ok: false, status: 404, error: "Event not found" };
  }

  if (event.isPrivate && event.hostId !== profileId) {
    return { ok: false, status: 404, error: "Event not found" };
  }

  if (event.hostId === profileId) {
    return { ok: false, status: 400, error: "You can't RSVP to your own event" };
  }

  const existing = await prisma.eventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId: profileId } },
  });
  const previousStatus = existing?.status ?? null;

  if (action === "going" && previousStatus !== "going" && event.priceCents > 0) {
    const checkout = await createEventCheckoutSession(profileId, eventId);
    if (!checkout.ok) {
      return { ok: false, status: checkout.status, error: checkout.error };
    }
    return { ok: true, state: "checkout", checkoutUrl: checkout.checkoutUrl };
  }

  if (action === "going" && previousStatus !== "going") {
    if (event.maxAttendees !== null && event.currentAttendees >= event.maxAttendees) {
      return { ok: false, status: 409, error: "This event is full." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId: profileId } },
      create: { eventId, userId: profileId, status: action },
      update: { status: action },
    });

    if (action === "going" && previousStatus !== "going") {
      await tx.event.update({ where: { id: eventId }, data: { currentAttendees: { increment: 1 } } });
    } else if (action !== "going" && previousStatus === "going") {
      await tx.event.update({ where: { id: eventId }, data: { currentAttendees: { decrement: 1 } } });
    }
  });

  return { ok: true, state: "updated", status: action };
}
