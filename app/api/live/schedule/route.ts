import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleLiveStream } from "@/lib/live-streams";

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
  const title = typeof body?.title === "string" ? body.title : "";
  const scheduledForRaw = typeof body?.scheduledFor === "string" ? new Date(body.scheduledFor) : null;
  if (!scheduledForRaw || Number.isNaN(scheduledForRaw.getTime())) {
    return NextResponse.json({ error: "Choose a valid date and time." }, { status: 400 });
  }

  const result = await scheduleLiveStream(profile.id, title, scheduledForRaw);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 201 });
}
