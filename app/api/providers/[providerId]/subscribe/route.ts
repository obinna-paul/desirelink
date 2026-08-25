import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribeToProvider } from "@/lib/providers";
import { subscribeToProviderSchema } from "@/lib/validations/provider-subscribe";

export async function POST(req: Request, { params }: { params: { providerId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriberProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, username: true },
  });
  if (!subscriberProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = subscribeToProviderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const provider = await prisma.profile.findUnique({
    where: { id: params.providerId },
    select: { username: true },
  });
  const origin = new URL(req.url).origin;
  const cancelUrl = `${origin}/profile/${provider?.username ?? params.providerId}`;

  const result = await subscribeToProvider(subscriberProfile.id, params.providerId, parsed.data.tierId, {
    successUrl: cancelUrl,
    cancelUrl,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.state === "checkout") {
    return NextResponse.json({ state: "checkout", checkoutUrl: result.checkoutUrl }, { status: 200 });
  }

  return NextResponse.json({ state: result.state }, { status: 200 });
}
