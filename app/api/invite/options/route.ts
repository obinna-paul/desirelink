import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  const [liveStream, events] = await Promise.all([
    prisma.liveStream.findFirst({
      where: { providerId: profile.id, status: "live" },
      select: { id: true },
    }),
    prisma.event.findMany({
      where: { hostId: profile.id, startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
      take: 10,
      select: { id: true, title: true, startTime: true },
    }),
  ]);

  return NextResponse.json({
    liveStreamId: liveStream?.id ?? null,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      startTime: event.startTime.toISOString(),
    })),
  });
}
