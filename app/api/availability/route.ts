import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveAvailability } from "@/lib/availability";
import { setAvailabilitySchema } from "@/lib/validations/availability";
import {
  AVAILABILITY_STATUS_CLEARED_EVENT,
  AVAILABILITY_STATUS_UPDATED_EVENT,
  triggerAvailabilityEvent,
} from "@/lib/pusher-server";

async function getViewerProfile(userId: string) {
  return prisma.profile.findUnique({
    where: { userId },
    select: { id: true, username: true, displayName: true, avatarUrl: true, isIncognito: true },
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getViewerProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const status = await getActiveAvailability(profile.id);
  return NextResponse.json({ status }, { status: 200 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = setAvailabilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const profile = await getViewerProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { status, durationHours } = parsed.data;
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.availabilityStatus.deleteMany({ where: { userId: profile.id } }),
    prisma.availabilityStatus.create({
      data: { userId: profile.id, status, expiresAt },
    }),
  ]);

  if (!profile.isIncognito) {
    await triggerAvailabilityEvent(AVAILABILITY_STATUS_UPDATED_EVENT, {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      status,
      expiresAt: expiresAt.toISOString(),
    });
  }

  return NextResponse.json(
    { status: { status, expiresAt: expiresAt.toISOString() } },
    { status: 200 }
  );
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getViewerProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  await prisma.availabilityStatus.deleteMany({ where: { userId: profile.id } });

  await triggerAvailabilityEvent(AVAILABILITY_STATUS_CLEARED_EVENT, { id: profile.id });

  return NextResponse.json({ status: null }, { status: 200 });
}
