import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unsubscribeFromProvider } from "@/lib/providers";

export async function POST(req: Request, { params }: { params: { providerId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriberProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!subscriberProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const tierId = typeof body?.tierId === "string" ? body.tierId : undefined;

  const result = await unsubscribeFromProvider(subscriberProfile.id, params.providerId, tierId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
