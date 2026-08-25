import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackServiceBooking } from "@/lib/rewards/tracking";

/**
 * Real booking (scheduling, confirmation, payment) doesn't exist yet — see
 * components/provider/ServiceListingMenu.tsx, which just shows "Booking
 * coming soon" after this call. This route only records the rewards-pool
 * engagement signal for the click so Service Providers start earning credit
 * for booking interest ahead of the real booking flow shipping.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [viewerProfile, listing] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
    prisma.serviceListing.findUnique({ where: { id: params.id }, select: { providerId: true } }),
  ]);

  if (!viewerProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  await trackServiceBooking(listing.providerId, viewerProfile.id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
