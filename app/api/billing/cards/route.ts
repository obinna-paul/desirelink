import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentMethods } from "@/lib/billing";
import { subscribeToPremium } from "@/lib/premium";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const cards = await getPaymentMethods(profile.id);
  return NextResponse.json({ cards }, { status: 200 });
}

/**
 * Paystack saves a reusable authorization after a successful real charge. So
 * "Add Card" starts checkout for udala premium ($5), the one product every
 * account can subscribe to; the resulting card gets saved once that payment
 * completes (see confirmProviderPayment / lib/payments/webhook-handler.ts).
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
