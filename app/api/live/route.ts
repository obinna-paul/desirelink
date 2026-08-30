import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveRingFeed, startLiveStream } from "@/lib/live-streams";

export async function GET() {
  const session = await getServerSession(authOptions);
  const profile = session?.user?.id
    ? await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    : null;

  const ring = await getLiveRingFeed(profile?.id ?? null);
  return NextResponse.json({ ring });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title : "";

  const result = await startLiveStream(profile.id, title);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 201 });
}
