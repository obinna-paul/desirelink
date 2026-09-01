import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { processPaymentEvent } from "@/lib/payments/webhook-handler";
import { profileCardSelect, type ProfileCardData } from "@/lib/home-feed";

async function getOrCreatePaymentCustomerId(profileId: string, existingCustomerId: string | null): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { user: { select: { email: true } } },
  });

  const customerId = await paymentProvider.createCustomer(profileId, profile.user.email);
  await prisma.profile.update({ where: { id: profileId }, data: { paymentCustomerId: customerId } });
  return customerId;
}

/**
 * Starts a real Paystack checkout for a priced event's first "going" RSVP —
 * charges a saved card directly when one exists, otherwise creates a pending
 * Transaction (the eventId ties it to this booking) and hands back a hosted
 * checkout URL. Mirrors subscribeToProvider/purchaseHearts.
 */
async function createEventRsvpCheckout(
  profileId: string,
  eventId: string,
  priceCents: number,
  urls: { successUrl: string; cancelUrl: string }
): Promise<RsvpResult> {
  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { paymentCustomerId: true },
  });
  const customerId = await getOrCreatePaymentCustomerId(profileId, profile.paymentCustomerId);
  const defaultCard = await prisma.paymentMethod.findFirst({ where: { userId: profileId, isDefault: true } });

  if (defaultCard) {
    const { reference, success } = await paymentProvider.chargeSavedPaymentMethod(
      customerId,
      defaultCard.externalId,
      priceCents,
      { kind: "event_rsvp" }
    );
    if (!success) {
      return { ok: false, status: 402, error: "Your saved card was declined. Try updating your payment method." };
    }

    const transaction = await prisma.transaction.create({
      data: { userId: profileId, eventId, amountCents: priceCents, status: "pending", provider: "card" },
    });
    await processPaymentEvent({
      type: "charge.succeeded",
      customerId,
      paymentMethod: null,
      amountCents: priceCents,
      reference,
      metadata: { kind: "event_rsvp", pendingId: transaction.id },
    });
    return { ok: true, state: "updated", status: "going" };
  }

  const transaction = await prisma.transaction.create({
    data: { userId: profileId, eventId, amountCents: priceCents, status: "pending", provider: "paystack" },
  });

  const checkoutUrl = await paymentProvider.createCheckoutSession(
    customerId,
    priceCents,
    urls.successUrl,
    urls.cancelUrl,
    { kind: "event_rsvp", pendingId: transaction.id }
  );

  return { ok: true, state: "checkout", checkoutUrl };
}

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

export async function isEventHost(eventId: string, profileId: string): Promise<boolean> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { hostId: true } });
  return event?.hostId === profileId;
}

/** The host, or anyone currently RSVP'd "going" — event chat is for confirmed attendees. */
export async function canAccessEventChat(eventId: string, profileId: string): Promise<boolean> {
  if (await isEventHost(eventId, profileId)) return true;
  const status = await getViewerRsvpStatus(eventId, profileId);
  return status === "going";
}

export type EventAttendees = {
  profiles: ProfileCardData[];
  counts: { total: number; couples: number; singles: number; creators: number; newMembers: number };
  hasHiddenAttendees: boolean;
};

const ATTENDEE_DISPLAY_LIMIT = 60;
const NEW_MEMBER_WINDOW_DAYS = 30;

/**
 * Attendee counts are aggregate social proof and always reflect every "going"
 * RSVP, incognito or not — same as the currentAttendees badge everyone
 * already sees. The avatar+name list is the privacy-sensitive part: it's
 * limited to non-incognito profiles unless the viewer can see the full guest
 * list (they're the host, or they're going themselves).
 */
export async function getEventAttendees(eventId: string, canSeeFullList: boolean): Promise<EventAttendees> {
  const goingAny = { eventRsvps: { some: { eventId, status: "going" as const } } };
  const listWhere = canSeeFullList ? goingAny : { ...goingAny, isIncognito: false };
  const newMemberSince = new Date(Date.now() - NEW_MEMBER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [profiles, total, couples, creators, newMembers] = await Promise.all([
    prisma.profile.findMany({
      where: listWhere,
      select: profileCardSelect(),
      orderBy: { displayName: "asc" },
      take: ATTENDEE_DISPLAY_LIMIT,
    }),
    prisma.profile.count({ where: goingAny }),
    prisma.profile.count({ where: { ...goingAny, profileType: "PAIR" } }),
    prisma.profile.count({ where: { ...goingAny, profileType: "CREATOR" } }),
    prisma.profile.count({ where: { ...goingAny, createdAt: { gte: newMemberSince } } }),
  ]);

  return {
    profiles,
    counts: { total, couples, singles: total - couples, creators, newMembers },
    hasHiddenAttendees: profiles.length < total,
  };
}

export type RsvpResult =
  | { ok: true; state: "updated"; status: RsvpAction | "waitlist"; message?: string }
  | { ok: true; state: "checkout"; checkoutUrl: string }
  | { ok: false; status: number; error: string };

/**
 * Handles a click on Going / Interested / Can't Go. A priced event's first
 * "going" hands off to Paystack instead of updating the RSVP directly — a
 * saved card is charged immediately, otherwise a checkout session is
 * started and the webhook (or the redirect-back confirm) flips it to
 * "going" on success. Leaving "going" (switching to interested/not_going)
 * is free and immediate.
 */
export async function setRsvp(
  profileId: string,
  eventId: string,
  action: RsvpAction,
  urls?: { successUrl: string; cancelUrl: string }
): Promise<RsvpResult> {
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
    if (event.maxAttendees !== null && event.currentAttendees >= event.maxAttendees) {
      return { ok: false, status: 409, error: "This event is full." };
    }
    if (!urls) {
      return { ok: false, status: 500, error: "Checkout is unavailable right now. Try again shortly." };
    }
    return createEventRsvpCheckout(profileId, eventId, event.priceCents, urls);
  }

  let savedStatus: RsvpAction | "waitlist" = action;
  let message: string | undefined;

  await prisma.$transaction(async (tx) => {
    if (action === "going" && previousStatus !== "going" && event.maxAttendees !== null && event.currentAttendees >= event.maxAttendees) {
      await tx.eventRsvp.upsert({
        where: { eventId_userId: { eventId, userId: profileId } },
        create: { eventId, userId: profileId, status: "waitlist" },
        update: { status: "waitlist" },
      });
      savedStatus = "waitlist";
      message = "This event is full, so you're on the waitlist.";
      return;
    }

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

  return { ok: true, state: "updated", status: savedStatus, message };
}

/**
 * Confirms a pending priced-event RSVP after the attendee returns from
 * checkout, by verifying the transaction reference directly with the
 * payment provider (Paystack's recommended pattern). Safe to call more than
 * once — processPaymentEvent no-ops once the pending Transaction is no
 * longer "pending".
 */
export async function confirmEventRsvpPayment(reference: string): Promise<void> {
  const event = await paymentProvider.verifyTransaction(reference);
  await processPaymentEvent(event);
}
