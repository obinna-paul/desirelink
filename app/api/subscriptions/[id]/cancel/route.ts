import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelSubscription } from "@/lib/legacy-checkout";
import { cancelProviderSubscriptionById } from "@/lib/providers";

/**
 * Cancels one row from "My subscriptions" (see lib/subscription-access.ts's
 * getMySubscriptions), which merges the legacy Subscription table with
 * ProviderSubscription - the table subscribeToProvider actually writes to. The id could
 * be either, so this tries the legacy table first and falls back to ProviderSubscription.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
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

  const legacySubscription = await prisma.subscription.findUnique({ where: { id: params.id } });
  if (legacySubscription) {
    if (legacySubscription.subscriberId !== profile.id) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }
    const result = await cancelSubscription(params.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ subscription: result.subscription }, { status: 200 });
  }

  const result = await cancelProviderSubscriptionById(params.id, profile.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
