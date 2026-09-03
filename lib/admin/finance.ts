import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { creditProviderWallet } from "@/lib/wallet";
import { recordAdminAction } from "@/lib/admin/audit";

const partySelect = { username: true, displayName: true } as const;

/** Service bookings whose payment is still held in escrow - the disputed/stuck ones an
 * admin needs to resolve manually, released automatically the rest of the time (see
 * completeServiceBooking in lib/service-bookings.ts and the daily cron safety net). */
export async function getHeldEscrowBookings() {
  return prisma.serviceBooking.findMany({
    where: { transaction: { escrowStatus: "held" } },
    orderBy: { createdAt: "asc" },
    include: {
      transaction: { select: { id: true, amountCents: true, providerReference: true } },
      provider: { select: partySelect },
      customer: { select: partySelect },
      listing: { select: { title: true } },
    },
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
    include: { transaction: true, provider: { select: { username: true } } },
  });
  if (!booking) {
    return { ok: false, status: 404, error: "Booking not found." };
  }
  if (!booking.transaction || booking.transaction.escrowStatus !== "held") {
    return { ok: false, status: 400, error: "No held payment on this booking." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: booking.transaction!.id },
      data: { escrowStatus: "released", escrowReleasedAt: new Date() },
    });
    await creditProviderWallet(booking.providerId, booking.transaction!.amountCents, tx);
    await tx.serviceBooking.update({ where: { id: bookingId }, data: { status: "completed", completedAt: new Date() } });
  });

  await recordAdminAction({
    actorId,
    action: "finance.release_escrow",
    targetType: "service_booking",
    targetId: bookingId,
    summary: `Released held escrow to @${booking.provider.username}`,
    metadata: { amountCents: booking.transaction.amountCents },
  });

  return { ok: true };
}

/** Admin-triggered refund for a disputed escrow - same real refund call the normal
 * decline/cancel path makes (refundHeldBooking in lib/service-bookings.ts), just reachable
 * for a booking that's stuck in "confirmed" rather than "pending_provider". */
export async function adminRefundEscrow(bookingId: string, actorId: string, reason: string): Promise<FinanceActionResult> {
  const booking = await prisma.serviceBooking.findUnique({
    where: { id: bookingId },
    include: { transaction: true, customer: { select: { username: true } } },
  });
  if (!booking) {
    return { ok: false, status: 404, error: "Booking not found." };
  }
  if (!booking.transaction || booking.transaction.escrowStatus !== "held") {
    return { ok: false, status: 400, error: "No held payment on this booking." };
  }

  if (booking.transaction.providerReference) {
    await paymentProvider.refundTransaction(booking.transaction.providerReference, booking.transaction.amountCents, {
      reason: reason || `Admin refund for booking ${bookingId}`,
    });
  }

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: booking.transaction.id },
      data: { escrowStatus: "refunded", escrowReleasedAt: new Date() },
    }),
    prisma.serviceBooking.update({ where: { id: bookingId }, data: { status: "cancelled" } }),
  ]);

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

  return { ok: true };
}
