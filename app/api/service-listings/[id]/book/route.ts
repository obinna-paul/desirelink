import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createServiceBooking } from "@/lib/service-bookings";

/**
 * Requests a booking slot on a service listing. Charges the customer
 * immediately and holds the payment in escrow — see
 * lib/service-bookings.ts's createServiceBooking — the provider must accept
 * before any work is expected, and the money only reaches their wallet once
 * the customer confirms the service was delivered.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const requestedAtRaw = body?.requestedAt;
  const note = typeof body?.note === "string" ? body.note : "";
  if (typeof requestedAtRaw !== "string") {
    return NextResponse.json({ error: "Choose a date and time for this booking." }, { status: 400 });
  }
  const requestedAt = new Date(requestedAtRaw);

  const origin = new URL(req.url).origin;
  const returnUrl = `${origin}/services/bookings`;

  const result = await createServiceBooking(profile.id, params.id, requestedAt, note, {
    successUrl: returnUrl,
    cancelUrl: returnUrl,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (result.state === "checkout") {
    return NextResponse.json({ state: result.state, checkoutUrl: result.checkoutUrl }, { status: 200 });
  }
  return NextResponse.json({ state: result.state, bookingId: result.bookingId }, { status: 200 });
}
