import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { processPaymentEvent } from "@/lib/payments/webhook-handler";
import { safeConfirmPayment } from "@/lib/payments/safe-call";
import { creditProviderWallet } from "@/lib/wallet";
import type { ServiceBooking } from "@prisma/client";

/**
 * How long after the requested service time an accepted-but-unconfirmed
 * booking's escrow auto-releases to the provider (see
 * app/api/cron/release-escrow/route.ts). Gives the customer a window to
 * flag a no-show or a problem before the money moves automatically.
 */
export const SERVICE_ESCROW_GRACE_HOURS = 48;

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
  | { ok: true; state: "checkout"; bookingId: string; checkoutUrl: string }
  | { ok: false; status: number; error: string };

const MAX_NOTE_LENGTH = 500;

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

  const listing = await prisma.serviceListing.findUnique({
    where: { id: listingId },
    select: { id: true, providerId: true, priceCents: true },
  });
  if (!listing) {
    return { ok: false, status: 404, error: "Listing not found." };
  }
  if (listing.providerId === customerId) {
    return { ok: false, status: 400, error: "You can't book your own service." };
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
        { kind: "service_booking" },
      );
      if (!success) {
        await prisma.serviceBooking.update({
          where: { id: booking.id },
          data: { status: "cancelled", declineReason: "Payment failed." },
        });
        return { ok: false, status: 402, error: "Your saved card was declined. Try updating your payment method." };
      }

      await processPaymentEvent({
        type: "charge.succeeded",
        customerId: paymentCustomerId,
        paymentMethod: null,
        amountCents: listing.priceCents,
        reference,
        metadata: { kind: "service_booking", pendingId: booking.id },
      });
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
    await prisma.serviceBooking.update({
      where: { id: booking.id },
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

  const updated = await prisma.serviceBooking.update({
    where: { id: bookingId },
    data: { status: "confirmed", respondedAt: new Date() },
  });
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

  await refundHeldBooking(booking.id, booking.transaction);

  const updated = await prisma.serviceBooking.update({
    where: { id: bookingId },
    data: { status: "declined", declineReason: reason.trim().slice(0, 500) || null, respondedAt: new Date() },
  });
  return { ok: true, booking: updated };
}

/** Customer cancels a booking before it's completed — refunds the held payment in full. Providers can no longer be booked-then-ghosted by a cancellation after they've done the work, since completion locks the booking. */
export async function cancelServiceBooking(bookingId: string, customerId: string): Promise<BookingActionResult> {
  const booking = await findBookingWithTransaction(bookingId);
  if (!booking) return { ok: false, status: 404, error: "Booking not found." };
  if (booking.customerId !== customerId) return { ok: false, status: 403, error: "Not your booking." };
  if (booking.status !== "pending_provider" && booking.status !== "confirmed") {
    return { ok: false, status: 409, error: "This booking can no longer be cancelled." };
  }

  await refundHeldBooking(booking.id, booking.transaction);

  const updated = await prisma.serviceBooking.update({
    where: { id: bookingId },
    data: { status: "cancelled" },
  });
  return { ok: true, booking: updated };
}

/** Customer confirms the service was delivered — releases the held payment to the provider's wallet. This is the only way money moves, short of the auto-release safety net. */
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

  const updated = await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: booking.transaction!.id },
      data: { escrowStatus: "released", escrowReleasedAt: new Date() },
    });
    await creditProviderWallet(booking.providerId, booking.transaction!.amountCents, tx);
    return tx.serviceBooking.update({
      where: { id: bookingId },
      data: { status: "completed", completedAt: new Date() },
    });
  });

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
  createdAt: true,
  listing: { select: { title: true, coverImageUrl: true } },
  provider: { select: { username: true, displayName: true, avatarUrl: true } },
  customer: { select: { username: true, displayName: true, avatarUrl: true } },
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
async function refundHeldBooking(
  bookingId: string,
  transaction: { id: string; amountCents: number; escrowStatus: string | null; providerReference: string | null } | null,
): Promise<void> {
  if (!transaction || transaction.escrowStatus !== "held") return;

  if (transaction.providerReference) {
    await paymentProvider.refundTransaction(transaction.providerReference, transaction.amountCents, {
      reason: `Service booking ${bookingId} refund`,
    });
  }

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { escrowStatus: "refunded", escrowReleasedAt: new Date() },
  });
}
