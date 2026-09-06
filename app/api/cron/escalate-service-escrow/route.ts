import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createNotificationsBulk } from "@/lib/notifications";
import { isCronAuthorized } from "@/lib/security/cron";
import { SERVICE_ESCROW_REVIEW_HOURS } from "@/lib/service-bookings";

/**
 * Raises stale held service payments to Finance without moving money. Funds
 * are released only by the customer or by an explicit admin resolution.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reviewBefore = new Date(Date.now() - SERVICE_ESCROW_REVIEW_HOURS * 60 * 60 * 1000);
  const [bookings, admins] = await Promise.all([
    prisma.serviceBooking.findMany({
      where: {
        status: { in: ["confirmed", "refund_requested"] },
        requestedAt: { lte: reviewBefore },
        adminEscalatedAt: null,
        transaction: { escrowStatus: "held" },
      },
      select: { id: true, status: true, listing: { select: { title: true } } },
    }),
    prisma.user.findMany({
      where: {
        isAdmin: true,
        OR: [{ adminRole: "FINANCE" }, { adminRole: "SUPERADMIN" }, { adminRole: null }],
      },
      select: { profile: { select: { id: true } } },
    }),
  ]);

  const adminProfileIds = admins.flatMap(({ profile }) => (profile ? [profile.id] : []));
  let escalated = 0;

  for (const booking of bookings) {
    if (adminProfileIds.length === 0) break;
    await createNotificationsBulk(
      adminProfileIds.map((recipientId) => ({
        recipientId,
        type: "booking",
        title: booking.status === "refund_requested" ? "Service refund needs review" : "Held service payment needs review",
        body: `${booking.listing.title} has remained in escrow beyond the review window.`,
        href: "/admin/finance",
      })),
    );
    await prisma.serviceBooking.update({
      where: { id: booking.id },
      data: { adminEscalatedAt: new Date() },
    });
    escalated += 1;
  }

  return NextResponse.json({ ok: true, escalated });
}

export async function POST(req: Request) {
  return GET(req);
}
