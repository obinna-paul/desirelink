import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribeToPremium } from "@/lib/premium";

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

  if (result.state === "checkout") {
    return NextResponse.json({ state: "checkout", checkoutUrl: result.checkoutUrl }, { status: 200 });
  }

  return NextResponse.json({ state: result.state }, { status: 200 });
}
