import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { purchaseHearts } from "@/lib/hearts";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const packageId = typeof body?.packageId === "string" ? body.packageId : "";

  const origin = new URL(req.url).origin;
  const returnUrl = `${origin}/wallet`;

  const result = await purchaseHearts(profile.id, packageId, { successUrl: returnUrl, cancelUrl: returnUrl });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 200 });
}
