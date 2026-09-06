import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { processPaymentEvent } from "@/lib/payments/webhook-handler";
import { safeConfirmPayment } from "@/lib/payments/safe-call";
import { creditProviderWallet } from "@/lib/wallet";
import { createNotification, createNotificationsBulk } from "@/lib/notifications";
import {
  sendBookingCancelledEmail,
  sendBookingConfirmedEmail,
  sendEscrowReleasedEmail,
} from "@/lib/email/booking-notifications";
import type { ServiceBooking } from "@prisma/client";

/**
 * How long a past-due held booking can remain untouched before finance is
 * asked to review it. This never releases money automatically.
 */
export const SERVICE_ESCROW_REVIEW_HOURS = 48;

async function getOrCreatePaymentCustomerId(
  profileId: string,
  existingCustomerId: string | null,
): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { user: { select: { email: true } } },
  });

  const customerId = await paymentProvider.createCustomer(profileId, profile.user.email);
  await prisma.profile.update({ where: { id: profileId }, data: { paymentCustomerId: customerId } });
  return customerId;
}

export type CreateBookingResult =
  | { ok: true; state: "pending_provider"; bookingId: string }
  | { ok: true; state: "processing_payment"; bookingId: string }
  | { ok: true; state: "checkout"; bookingId: string; checkoutUrl: string }
  | { ok: false; status: number; error: string };

const MAX_NOTE_LENGTH = 500;

async function deliverBookingSideEffects(tasks: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected") console.error("[booking] notification delivery failed", result.reason);
  });
}

async function escalateRefundFailure(
  booking: { id: string; providerId: string; customerId: string },
  reason: string,
): Promise<void> {
  await prisma.serviceBooking.update({
    where: { id: booking.id },
    data: {
      status: "refund_requested",
      refundRequestedAt: new Date(),
      refundReason: reason,
      adminEscalatedAt: new Date(),
    },
  });
  const admins = await prisma.user.findMany({
    where: {
      isAdmin: true,
      OR: [{ adminRole: "FINANCE" }, { adminRole: "SUPERADMIN" }, { adminRole: null }],
    },
    select: { profile: { select: { id: true } } },
  });
  await deliverBookingSideEffects([
    createNotificationsBulk([
      {
        recipientId: booking.providerId,
        type: "booking",
        title: "Refund needs finance review",
        body: "The automatic refund could not complete. Payment remains locked in escrow.",
        href: "/services/bookings",
      },
      {
        recipientId: booking.customerId,
        type: "booking",
        title: "Refund needs finance review",
        body: "Your payment is still protected. Udala Finance has been notified.",
        href: "/services/bookings",
      },
      ...admins.flatMap(({ profile }) => profile ? [{
        recipientId: profile.id,
        type: "booking" as const,
        title: "Service refund needs manual action",
        body: reason,
        href: "/admin/finance",
      }] : []),
    ]),
  ]);
}

/**
 * Starts a service booking request. Payment is charged immediately (a saved
 * card is billed directly; otherwise the customer is sent to checkout first)
 * and held in escrow — see handleServiceBookingEvent in
 * lib/payments/webhook-handler.ts, which is what actually flips the booking
 * to "pending_provider" and marks the Transaction escrow "held" once the
 * charge is confirmed. The provider never sees a booking, and the customer
 * is never at risk of losing money to a provider who does nothing, until
 * that confirmation happens.
 */
export async function createServiceBooking(
  customerId: string,
  listingId: string,
  requestedAt: Date,
  note: string,
  urls: { successUrl: string; cancelUrl: string },
): Promise<CreateBookingResult> {
  if (Number.isNaN(requestedAt.getTime()) || requestedAt.getTime() <= Date.now()) {
    return { ok: false, status: 400, error: "Choose a date and time in the future." };
  }

  const listing = await prisma.serviceListing.findFirst({
    where: { id: listingId, isActive: true, provider: { isSuspended: false } },
    select: { id: true, providerId: true, priceCents: true },
  });
  if (!listing) {
    return { ok: false, status: 404, error: "Listing not found." };
  }
  if (listing.providerId === customerId) {
    return { ok: false, status: 400, error: "You can't book your own service." };
  }
  if (listing.priceCents < 10_000) {
    return { ok: false, status: 409, error: "This listing needs a valid price before it can be booked." };
  }

  const trimmedNote = note.trim().slice(0, MAX_NOTE_LENGTH);

  const booking = await prisma.serviceBooking.create({
    data: {
      listingId: listing.id,
      providerId: listing.providerId,
      customerId,
      requestedAt,
      note: trimmedNote,
      priceCents: listing.priceCents,
      status: "pending_payment",
    },
  });

  let paymentCaptured = false;
  try {
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { id: customerId },
      select: { paymentCustomerId: true },
    });
    const paymentCustomerId = await getOrCreatePaymentCustomerId(customerId, profile.paymentCustomerId);
    const defaultCard = await prisma.paymentMethod.findFirst({ where: { userId: customerId, isDefault: true } });

    if (defaultCard) {
      const { reference, success } = await paymentProvider.chargeSavedPaymentMethod(
        paymentCustomerId,
        defaultCard.externalId,
        listing.priceCents,
        { kind: "service_booking", pendingId: booking.id },
      );
      if (!success) {
        await prisma.serviceBooking.update({
          where: { id: booking.id },
          data: { status: "cancelled", declineReason: "Payment failed." },
        });
        return { ok: false, status: 402, error: "Your saved card was declined. Try updating your payment method." };
      }

      paymentCaptured = true;
      const event = await paymentProvider.verifyTransaction(reference);
      await processPaymentEvent(event);
      return { ok: true, state: "pending_provider", bookingId: booking.id };
    }

    const checkoutUrl = await paymentProvider.createCheckoutSession(
      paymentCustomerId,
      listing.priceCents,
      urls.successUrl,
      urls.cancelUrl,
      { kind: "service_booking", pendingId: booking.id },
    );

    return { ok: true, state: "checkout", bookingId: booking.id, checkoutUrl };
  } catch (error) {
    console.error("[payments] createServiceBooking failed", error);
    if (paymentCaptured) {
      const current = await prisma.serviceBooking.findUnique({ where: { id: booking.id }, select: { status: true } });
      return current?.status === "pending_provider"
        ? { ok: true, state: "pending_provider", bookingId: booking.id }
        : { ok: true, state: "processing_payment", bookingId: booking.id };
    }
    await prisma.serviceBooking.updateMany({
      where: { id: booking.id, status: "pending_payment" },
      data: { status: "cancelled", declineReason: "Payment failed." },
    });
    return { ok: false, status: 502, error: "We couldn't reach the payment provider. Please try again in a moment." };
  }
}

/**
 * Confirms a booking's payment after the customer returns from checkout, by
 * verifying the transaction reference directly with the payment provider.
 * Safe to call more than once.
 */
export async function confirmServiceBookingPayment(reference: string): Promise<void> {
  await safeConfirmPayment("confirmServiceBookingPayment", async () => {
    const event = await paymentProvider.verifyTransaction(reference);
    await processPaymentEvent(event);
  });
}

export type BookingActionResult =
  | { ok: true; booking: ServiceBooking }
  | { ok: false; status: number; error: string };

async function findBookingWithTransaction(bookingId: string) {
  return prisma.serviceBooking.findUnique({
    where: { id: bookingId },
    include: { transaction: true },
  });
}

/** Provider accepts a pending booking request. The customer's charge stays held in escrow until completion is confirmed. */
export async function acceptServiceBooking(bookingId: string, providerId: string): Promise<BookingActionResult> {
  const booking = await findBookingWithTransaction(bookingId);
  if (!booking) return { ok: false, status: 404, error: "Booking not found." };
  if (booking.providerId !== providerId) return { ok: false, status: 403, error: "Not your booking." };
  if (booking.status !== "pending_provider") {
    return { ok: false, status: 409, error: "This booking has already been responded to." };
  }

  const claim = await prisma.serviceBooking.updateMany({
    where: { id: bookingId, status: "pending_provider", transaction: { escrowStatus: "held" } },
    data: { status: "confirmed", respondedAt: new Date() },
  });
  if (claim.count !== 1) {
    return { ok: false, status: 409, error: "This booking is already being resolved." };
  }
  const updated = await prisma.serviceBooking.findUniqueOrThrow({ where: { id: bookingId } });
  await deliverBookingSideEffects([
    createNotification({
      recipientId: booking.customerId,
      actorId: booking.providerId,
      type: "booking",
      title: "Booking accepted",
      body: "Your provider accepted the booking. Your payment remains protected in escrow.",
      href: "/services/bookings",
    }),
    sendBookingConfirmedEmail(bookingId),
  ]);
  return { ok: true, booking: updated };
}

/** Provider declines a pending booking request — the held payment is refunded to the customer in full. */
export async function declineServiceBooking(
  bookingId: string,
  providerId: string,
  reason: string,
): Promise<BookingActionResult> {
  const booking = await findBookingWithTransaction(bookingId);
  if (!booking) return { ok: false, status: 404, error: "Booking not found." };
  if (booking.providerId !== providerId) return { ok: false, status: 403, error: "Not your booking." };
  if (booking.status !== "pending_provider") {
    return { ok: false, status: 409, error: "This booking has already been responded to." };
  }

  const trimmedReason = reason.trim().slice(0, 500) || null;
  const claim = await prisma.serviceBooking.updateMany({
    where: { id: bookingId, status: "pending_provider", transaction: { escrowStatus: "held" } },
    data: { status: "declined", declineReason: trimmedReason, respondedAt: new Date() },
  });
  if (claim.count !== 1) {
    return { ok: false, status: 409, error: "This booking is already being resolved." };
  }
  try {
    const refundClaimed = await refundHeldServiceBooking(booking.id, booking.transaction);
    if (!refundClaimed) throw new Error("The held payment could not be claimed for refund.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "The automatic refund could not be started.";
    await escalateRefundFailure(booking, message);
    return { ok: false, status: 502, error: "The refund needs manual review. Udala Finance has been notified." };
  }
  const updated = await prisma.serviceBooking.findUniqueOrThrow({ where: { id: bookingId } });
  await deliverBookingSideEffects([
    createNotification({
      recipientId: booking.customerId,
      actorId: booking.providerId,
      type: "booking",
      title: "Booking declined",
      body: "The booking was declined and your payment is being refunded.",
      href: "/services/bookings",
    }),
    sendBookingCancelledEmail(bookingId, "customer", trimmedReason),
  ]);
  return { ok: true, booking: updated };
}

/** Customer can cancel while the provider has not accepted. Accepted work uses the refund-review flow instead. */
export async function cancelServiceBooking(bookingId: string, customerId: string): Promise<BookingActionResult> {
  const booking = await findBookingWithTransaction(bookingId);
  if (!booking) return { ok: false, status: 404, error: "Booking not found." };
  if (booking.customerId !== customerId) return { ok: false, status: 403, error: "Not your booking." };
  if (booking.status !== "pending_provider") {
    return { ok: false, status: 409, error: "This booking can no longer be cancelled." };
  }

  const claim = await prisma.serviceBooking.updateMany({
    where: { id: bookingId, status: "pending_provider", transaction: { escrowStatus: "held" } },
    data: { status: "cancelled" },
  });
  if (claim.count !== 1) {
    return { ok: false, status: 409, error: "This booking is already being resolved." };
  }
  try {
    const refundClaimed = await refundHeldServiceBooking(booking.id, booking.transaction);
    if (!refundClaimed) throw new Error("The held payment could not be claimed for refund.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "The automatic refund could not be started.";
    await escalateRefundFailure(booking, message);
    return { ok: false, status: 502, error: "The refund needs manual review. Udala Finance has been notified." };
  }
  const updated = await prisma.serviceBooking.findUniqueOrThrow({ where: { id: bookingId } });
  await deliverBookingSideEffects([
    createNotification({
      recipientId: booking.providerId,
      actorId: booking.customerId,
      type: "booking",
      title: "Booking cancelled",
      body: "The customer cancelled before you accepted. Their held payment is being refunded.",
      href: "/services/bookings",
    }),
    sendBookingCancelledEmail(bookingId, "provider", null),
  ]);
  return { ok: true, booking: updated };
}

/** Customer confirms delivery and explicitly releases the held payment to the provider wallet. */
export async function completeServiceBooking(bookingId: string, customerId: string): Promise<BookingActionResult> {
  const booking = await findBookingWithTransaction(bookingId);
  if (!booking) return { ok: false, status: 404, error: "Booking not found." };
  if (booking.customerId !== customerId) return { ok: false, status: 403, error: "Not your booking." };
  if (booking.status !== "confirmed") {
    return { ok: false, status: 409, error: "This booking isn't ready to be marked complete." };
  }
  if (!booking.transaction || booking.transaction.escrowStatus !== "held") {
    return { ok: false, status: 409, error: "No held payment found for this booking." };
  }

  let updated: ServiceBooking | null;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const bookingClaim = await tx.serviceBooking.updateMany({
        where: { id: bookingId, status: "confirmed" },
        data: { status: "completed", completedAt: new Date() },
      });
      if (bookingClaim.count !== 1) return null;

      const escrowClaim = await tx.transaction.updateMany({
        where: { id: booking.transaction!.id, escrowStatus: "held" },
        data: { escrowStatus: "released", escrowReleasedAt: new Date() },
      });
      if (escrowClaim.count !== 1) throw new Error("ESCROW_ALREADY_RESOLVED");
      await creditProviderWallet(booking.providerId, booking.transaction!.amountCents, tx);
      return tx.serviceBooking.findUniqueOrThrow({ where: { id: bookingId } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ESCROW_ALREADY_RESOLVED") {
      return { ok: false, status: 409, error: "This payment is already being resolved." };
    }
    throw error;
  }

  if (!updated) {
    return { ok: false, status: 409, error: "This booking is already being resolved." };
  }

  await deliverBookingSideEffects([
    createNotification({
      recipientId: booking.providerId,
      actorId: booking.customerId,
      type: "booking",
      title: "Payment released",
      body: "The customer confirmed delivery. The payment is now available in your wallet.",
      href: "/wallet",
    }),
    sendEscrowReleasedEmail(bookingId),
  ]);
  return { ok: true, booking: updated };
}

/** Customer reports a problem after acceptance. Money stays held until finance resolves it. */
export async function requestServiceBookingRefund(
  bookingId: string,
  customerId: string,
  reason: string,
): Promise<BookingActionResult> {
  const booking = await findBookingWithTransaction(bookingId);
  if (!booking) return { ok: false, status: 404, error: "Booking not found." };
  if (booking.customerId !== customerId) return { ok: false, status: 403, error: "Not your booking." };
  if (booking.status !== "confirmed") {
    return { ok: false, status: 409, error: "This booking cannot be sent for refund review." };
  }
  if (!booking.transaction || booking.transaction.escrowStatus !== "held") {
    return { ok: false, status: 409, error: "No held payment found for this booking." };
  }

  const trimmedReason = reason.trim().slice(0, 500);
  if (trimmedReason.length < 10) {
    return { ok: false, status: 400, error: "Tell us what went wrong in at least 10 characters." };
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const claim = await tx.serviceBooking.updateMany({
      where: { id: bookingId, status: "confirmed", transaction: { escrowStatus: "held" } },
      data: {
        status: "refund_requested",
        refundRequestedAt: now,
        refundReason: trimmedReason,
        adminEscalatedAt: now,
      },
    });
    if (claim.count !== 1) return null;
    return tx.serviceBooking.findUniqueOrThrow({ where: { id: bookingId } });
  });
  if (!updated) {
    return { ok: false, status: 409, error: "This booking is already being resolved." };
  }

  const admins = await prisma.user.findMany({
    where: {
      isAdmin: true,
      OR: [{ adminRole: "FINANCE" }, { adminRole: "SUPERADMIN" }, { adminRole: null }],
    },
    select: { profile: { select: { id: true } } },
  });

  await deliverBookingSideEffects([
    createNotificationsBulk([
      {
        recipientId: booking.providerId,
        actorId: booking.customerId,
        type: "booking",
        title: "Refund review opened",
        body: "The customer reported a problem. Payment remains held while Udala reviews it.",
        href: "/services/bookings",
      },
      ...admins.flatMap(({ profile }) =>
        profile
          ? [{
              recipientId: profile.id,
              type: "booking" as const,
              title: "Service refund needs review",
              body: trimmedReason,
              href: "/admin/finance",
            }]
          : [],
      ),
    ]),
  ]);

  return { ok: true, booking: updated };
}

const BOOKING_LIST_SELECT = {
  id: true,
  listingId: true,
  providerId: true,
  customerId: true,
  requestedAt: true,
  note: true,
  priceCents: true,
  status: true,
  declineReason: true,
  respondedAt: true,
  completedAt: true,
  refundRequestedAt: true,
  refundReason: true,
  createdAt: true,
  listing: { select: { title: true, coverImageUrl: true } },
  provider: { select: { username: true, displayName: true, avatarUrl: true } },
  customer: { select: { username: true, displayName: true, avatarUrl: true } },
  transaction: { select: { escrowStatus: true } },
} as const;

/** A provider's bookings, newest request first — used to render the accept/decline queue and history. */
export async function getProviderBookings(providerId: string) {
  return prisma.serviceBooking.findMany({
    where: { providerId },
    orderBy: { createdAt: "desc" },
    select: BOOKING_LIST_SELECT,
  });
}

/** A customer's own booking history, newest request first. */
export async function getCustomerBookings(customerId: string) {
  return prisma.serviceBooking.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: BOOKING_LIST_SELECT,
  });
}

/** Shared refund helper for decline/cancel — no-ops safely if payment never actually reached "held" (e.g. it's still mid-checkout). */
export async function refundHeldServiceBooking(
  bookingId: string,
  transaction: { id: string; amountCents: number; escrowStatus: string | null; providerReference: string | null } | null,
): Promise<boolean> {
  if (!transaction || transaction.escrowStatus !== "held") return false;

  const claim = await prisma.transaction.updateMany({
    where: { id: transaction.id, escrowStatus: "held" },
    data: { escrowStatus: "refund_pending" },
  });
  if (claim.count !== 1) return false;

  try {
    if (!transaction.providerReference) {
      throw new Error("This legacy payment has no provider reference and needs manual finance review.");
    }
    const refund = await paymentProvider.refundTransaction(transaction.providerReference, transaction.amountCents, {
      reason: `Service booking ${bookingId} refund`,
    });
    if (refund.status === "failed") throw new Error("The payment provider rejected this refund.");
    if (refund.status === "pending") return true;
  } catch (error) {
    await prisma.transaction.updateMany({
      where: { id: transaction.id, escrowStatus: "refund_pending" },
      data: { escrowStatus: "held" },
    });
    throw error;
  }

  await prisma.transaction.updateMany({
    where: { id: transaction.id, escrowStatus: "refund_pending" },
    data: { escrowStatus: "refunded", escrowReleasedAt: new Date() },
  });
  return true;
}
