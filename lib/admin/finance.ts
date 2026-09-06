import "server-only";

import { prisma } from "@/lib/prisma";
import { creditProviderWallet } from "@/lib/wallet";
import { recordAdminAction } from "@/lib/admin/audit";
import { createNotification } from "@/lib/notifications";
import { sendBookingCancelledEmail, sendEscrowReleasedEmail } from "@/lib/email/booking-notifications";
import { refundHeldServiceBooking } from "@/lib/service-bookings";

const partySelect = { username: true, displayName: true } as const;

/** All service payments still held in escrow. Customer-raised refund requests are sorted
 * first so finance sees actionable disputes before routine in-progress bookings. */
export async function getHeldEscrowBookings() {
  const bookings = await prisma.serviceBooking.findMany({
    where: { transaction: { escrowStatus: { in: ["held", "refund_pending"] } } },
    orderBy: { createdAt: "asc" },
    include: {
      transaction: { select: { id: true, amountCents: true, providerReference: true, escrowStatus: true } },
      provider: { select: partySelect },
      customer: { select: partySelect },
      listing: { select: { title: true } },
    },
  });
  return bookings.sort((a, b) => {
    const aPriority = a.status === "refund_requested" ? 0 : 1;
    const bPriority = b.status === "refund_requested" ? 0 : 1;
    return aPriority - bPriority || a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export type HeldEscrowBooking = Awaited<ReturnType<typeof getHeldEscrowBookings>>[number];

export async function getTransactionLedger(take = 50) {
  return prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { profile: { select: partySelect } },
  });
}

export type LedgerTransaction = Awaited<ReturnType<typeof getTransactionLedger>>[number];

export async function getPayoutHistory(take = 50) {
  return prisma.walletWithdrawal.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { provider: { select: partySelect } },
  });
}

export type PayoutHistoryEntry = Awaited<ReturnType<typeof getPayoutHistory>>[number];

export async function getHeartsEconomySummary() {
  const [purchased, gifted] = await Promise.all([
    prisma.heartPurchase.aggregate({
      where: { status: "succeeded" },
      _sum: { hearts: true, amountCents: true },
      _count: { _all: true },
    }),
    prisma.gift.aggregate({
      _sum: { hearts: true, valueCents: true },
      _count: { _all: true },
    }),
  ]);

  return {
    heartsPurchased: purchased._sum.hearts ?? 0,
    revenueFromHeartsCents: purchased._sum.amountCents ?? 0,
    purchaseCount: purchased._count._all,
    heartsGifted: gifted._sum.hearts ?? 0,
    giftValueCents: gifted._sum.valueCents ?? 0,
    giftCount: gifted._count._all,
  };
}

export type FinanceActionResult = { ok: true } | { ok: false; status: number; error: string };

/** Admin-triggered release for a disputed/stuck escrow - mirrors completeServiceBooking's
 * money movement exactly, just authorized by admin capability instead of matching the
 * customer's own id (an admin isn't a party to the booking). */
export async function adminReleaseEscrow(bookingId: string, actorId: string): Promise<FinanceActionResult> {
  const booking = await prisma.serviceBooking.findUnique({
    where: { id: bookingId },
    include: {
      transaction: true,
      provider: { select: { id: true, username: true } },
      customer: { select: { id: true } },
    },
  });
  if (!booking) {
    return { ok: false, status: 404, error: "Booking not found." };
  }
  if (!booking.transaction || booking.transaction.escrowStatus !== "held") {
    return { ok: false, status: 400, error: "No held payment on this booking." };
  }

  let released: boolean;
  try {
    released = await prisma.$transaction(async (tx) => {
      const bookingClaim = await tx.serviceBooking.updateMany({
        where: { id: bookingId, status: { in: ["confirmed", "refund_requested"] } },
        data: { status: "completed", completedAt: new Date() },
      });
      if (bookingClaim.count !== 1) return false;
      const escrowClaim = await tx.transaction.updateMany({
        where: { id: booking.transaction!.id, escrowStatus: "held" },
        data: { escrowStatus: "released", escrowReleasedAt: new Date() },
      });
      if (escrowClaim.count !== 1) throw new Error("ESCROW_ALREADY_RESOLVED");
      await creditProviderWallet(booking.providerId, booking.transaction!.amountCents, tx);
      return true;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ESCROW_ALREADY_RESOLVED") {
      return { ok: false, status: 409, error: "This payment is already being resolved." };
    }
    throw error;
  }
  if (!released) {
    return { ok: false, status: 409, error: "This booking is already being resolved." };
  }

  await recordAdminAction({
    actorId,
    action: "finance.release_escrow",
    targetType: "service_booking",
    targetId: bookingId,
    summary: `Released held escrow to @${booking.provider.username}`,
    metadata: { amountCents: booking.transaction.amountCents },
  });
  const deliveries = await Promise.allSettled([
    createNotification({
      recipientId: booking.providerId,
      type: "booking",
      title: "Escrow released by Udala",
      body: "Finance resolved the booking and the payment is now available in your wallet.",
      href: "/wallet",
    }),
    createNotification({
      recipientId: booking.customerId,
      type: "booking",
      title: "Booking review resolved",
      body: "Udala reviewed the booking and released the held payment to the provider.",
      href: "/services/bookings",
    }),
    sendEscrowReleasedEmail(bookingId),
  ]);
  deliveries.forEach((delivery) => {
    if (delivery.status === "rejected") console.error("[admin finance] release notification failed", delivery.reason);
  });

  return { ok: true };
}

/** Admin-triggered refund for a disputed escrow - same real refund call the normal
 * decline/cancel path makes (refundHeldServiceBooking in lib/service-bookings.ts), just reachable
 * for a booking that's stuck in "confirmed" rather than "pending_provider". */
export async function adminRefundEscrow(bookingId: string, actorId: string, reason: string): Promise<FinanceActionResult> {
  const booking = await prisma.serviceBooking.findUnique({
    where: { id: bookingId },
    include: {
      transaction: true,
      customer: { select: { id: true, username: true } },
      provider: { select: { id: true } },
    },
  });
  if (!booking) {
    return { ok: false, status: 404, error: "Booking not found." };
  }
  if (!booking.transaction || booking.transaction.escrowStatus !== "held") {
    return { ok: false, status: 400, error: "No held payment on this booking." };
  }

  const refunded = await refundHeldServiceBooking(booking.id, booking.transaction);
  if (!refunded) {
    return { ok: false, status: 409, error: "This payment is already being resolved." };
  }
  await prisma.serviceBooking.update({ where: { id: bookingId }, data: { status: "cancelled" } });

  await recordAdminAction({
    actorId,
    action: "finance.refund_escrow",
    targetType: "service_booking",
    targetId: bookingId,
    summary: reason
      ? `Refunded held escrow to @${booking.customer.username}: ${reason}`
      : `Refunded held escrow to @${booking.customer.username}`,
    metadata: { amountCents: booking.transaction.amountCents, reason },
  });
  const deliveries = await Promise.allSettled([
    createNotification({
      recipientId: booking.customerId,
      type: "booking",
      title: "Refund approved",
      body: "Udala approved your service refund. The payment is on its way back to you.",
      href: "/services/bookings",
    }),
    createNotification({
      recipientId: booking.providerId,
      type: "booking",
      title: "Booking refund resolved",
      body: "Udala approved the customer's refund request. No payment was released.",
      href: "/services/bookings",
    }),
    sendBookingCancelledEmail(bookingId, "customer", reason || booking.refundReason),
    sendBookingCancelledEmail(bookingId, "provider", reason || booking.refundReason),
  ]);
  deliveries.forEach((delivery) => {
    if (delivery.status === "rejected") console.error("[admin finance] refund notification failed", delivery.reason);
  });

  return { ok: true };
}
