import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/security/cron";
import { creditProviderWallet } from "@/lib/wallet";
import { SERVICE_ESCROW_GRACE_HOURS } from "@/lib/service-bookings";
import { sendEscrowReleasedEmail } from "@/lib/email/booking-notifications";

/**
 * Safety net for escrowed payments that were never explicitly released or
 * refunded: a confirmed service booking whose requested time has passed the
 * grace period. Meant to run daily (see vercel.json) — customers are still
 * free to confirm early via the "confirm completion" action, which releases
 * funds immediately without waiting for this.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  let serviceBookingsReleased = 0;

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
    await sendEscrowReleasedEmail(booking.id);
    serviceBookingsReleased += 1;
  }

  return NextResponse.json({ ok: true, serviceBookingsReleased });
}

export async function POST(req: Request) {
  return GET(req);
}
