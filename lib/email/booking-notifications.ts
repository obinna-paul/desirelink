import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { NewBookingRequestEmail } from "@/components/emails/new-booking-request";
import { BookingConfirmedEmail } from "@/components/emails/booking-confirmed";
import { EscrowReleasedEmail } from "@/components/emails/escrow-released";
import { BookingCancelledEmail } from "@/components/emails/booking-cancelled";

function formatDate(date: Date): string {
  return date.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

const bookingEmailSelect = {
  requestedAt: true,
  priceCents: true,
  listing: { select: { title: true } },
  provider: { select: { displayName: true, user: { select: { email: true } } } },
  customer: { select: { displayName: true, user: { select: { email: true } } } },
} as const;

async function getBookingForEmail(bookingId: string) {
  return prisma.serviceBooking.findUnique({ where: { id: bookingId }, select: bookingEmailSelect });
}

export async function sendNewBookingRequestEmail(bookingId: string): Promise<void> {
  const booking = await getBookingForEmail(bookingId);
  if (!booking) return;

  await sendEmail({
    to: booking.provider.user.email,
    subject: `New booking request from ${booking.customer.displayName}`,
    react: NewBookingRequestEmail({
      customerName: booking.customer.displayName,
      serviceName: booking.listing.title,
      requestedAt: formatDate(booking.requestedAt),
      amountCents: booking.priceCents,
    }),
    category: "bookings",
    template: "new-booking-request",
  });
}

export async function sendBookingConfirmedEmail(bookingId: string): Promise<void> {
  const booking = await getBookingForEmail(bookingId);
  if (!booking) return;

  await sendEmail({
    to: booking.customer.user.email,
    subject: `Your booking with ${booking.provider.displayName} is confirmed`,
    react: BookingConfirmedEmail({
      providerName: booking.provider.displayName,
      serviceName: booking.listing.title,
      requestedAt: formatDate(booking.requestedAt),
      amountCents: booking.priceCents,
    }),
    category: "bookings",
    template: "booking-confirmed",
  });
}

export async function sendEscrowReleasedEmail(bookingId: string): Promise<void> {
  const booking = await getBookingForEmail(bookingId);
  if (!booking) return;

  await sendEmail({
    to: booking.provider.user.email,
    subject: `${booking.listing.title} — escrow released`,
    react: EscrowReleasedEmail({
      customerName: booking.customer.displayName,
      serviceName: booking.listing.title,
      amountCents: booking.priceCents,
    }),
    category: "bookings",
    template: "escrow-released",
  });
}

/** audience "customer" fires when a provider declines (the customer gets refunded);
 * "provider" fires when a customer cancels a confirmed booking (the provider never held
 * the money, so gets a different closing line - see BookingCancelledEmail). */
export async function sendBookingCancelledEmail(
  bookingId: string,
  audience: "customer" | "provider",
  reason: string | null,
): Promise<void> {
  const booking = await getBookingForEmail(bookingId);
  if (!booking) return;

  const recipient = audience === "customer" ? booking.customer : booking.provider;

  await sendEmail({
    to: recipient.user.email,
    subject: `Your booking for ${booking.listing.title} was cancelled`,
    react: BookingCancelledEmail({
      audience,
      serviceName: booking.listing.title,
      requestedAt: formatDate(booking.requestedAt),
      amountCents: booking.priceCents,
      reason,
    }),
    category: "bookings",
    template: "booking-cancelled",
  });
}
