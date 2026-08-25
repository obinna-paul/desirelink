import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribeToPremium } from "@/lib/premium";

/**
 * Paystack has no SetupIntent / client-secret concept (Stripe Elements is a
 * Stripe-specific pattern) — saving a card here means starting a real
 * checkout. This route exists for parity with the original spec; it does the
 * same thing as POST /api/billing/cards. The frontend redirects the browser
 * to `checkoutUrl` instead of mounting a card element.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  const returnUrl = `${origin}/settings/billing`;

  const result = await subscribeToPremium(profile.id, { successUrl: returnUrl, cancelUrl: returnUrl });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (result.state === "subscribed") {
    return NextResponse.json(
      { error: "You already have a saved card. New cards are added the next time you subscribe to something." },
      { status: 400 }
    );
  }

  return NextResponse.json({ checkoutUrl: result.checkoutUrl }, { status: 200 });
}
