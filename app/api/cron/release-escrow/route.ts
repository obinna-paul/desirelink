import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/security/cron";
import { creditProviderWallet } from "@/lib/wallet";
import { SERVICE_ESCROW_GRACE_HOURS } from "@/lib/service-bookings";
import { EVENT_ESCROW_GRACE_HOURS } from "@/lib/event-escrow";

/**
 * Safety net for escrowed payments that were never explicitly released or
 * refunded: a confirmed service booking whose requested time has passed the
 * grace period, or a paid event RSVP whose event ended more than the grace
 * period ago. Meant to run daily (see vercel.json) — customers are still
 * free to confirm early via the "confirm completion" / "confirm attendance"
 * actions, which release funds immediately without waiting for this.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  let serviceBookingsReleased = 0;
  let eventTicketsReleased = 0;

  const dueBookings = await prisma.serviceBooking.findMany({
    where: {
      status: "confirmed",
      requestedAt: { lte: new Date(now - SERVICE_ESCROW_GRACE_HOURS * 60 * 60 * 1000) },
    },
    include: { transaction: true },
  });

  for (const booking of dueBookings) {
    if (!booking.transaction || booking.transaction.escrowStatus !== "held") continue;
    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: booking.transaction!.id },
        data: { escrowStatus: "released", escrowReleasedAt: new Date() },
      });
      await creditProviderWallet(booking.providerId, booking.transaction!.amountCents, tx);
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: { status: "completed", completedAt: new Date() },
      });
    });
    serviceBookingsReleased += 1;
  }

  const dueEventTransactions = await prisma.transaction.findMany({
    where: {
      escrowStatus: "held",
      eventId: { not: null },
      event: { is: { endTime: { lte: new Date(now - EVENT_ESCROW_GRACE_HOURS * 60 * 60 * 1000) } } },
    },
    include: { event: { select: { hostId: true } } },
  });

  for (const transaction of dueEventTransactions) {
    if (!transaction.event) continue;
    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { escrowStatus: "released", escrowReleasedAt: new Date() },
      });
      await creditProviderWallet(transaction.event!.hostId, transaction.amountCents, tx);
    });
    eventTicketsReleased += 1;
  }

  return NextResponse.json({ ok: true, serviceBookingsReleased, eventTicketsReleased });
}

export async function POST(req: Request) {
  return GET(req);
}
