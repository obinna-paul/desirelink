import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendHeartsToProvider } from "@/lib/hearts";

/** Sends hearts directly to a provider — from their profile page, or from a chat thread with them. */
export async function POST(req: Request, { params }: { params: { providerId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const hearts = typeof body?.hearts === "number" ? body.hearts : NaN;
  const context = body?.context === "chat" ? "chat" : "profile";

  const result = await sendHeartsToProvider(profile.id, params.providerId, hearts, context);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
