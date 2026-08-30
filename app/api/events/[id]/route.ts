import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventFormSchema } from "@/lib/validations/event";
import { readJson } from "@/lib/security/request";

async function getOwnedEvent(userId: string, eventId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return null;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.hostId !== profile.id) return null;

  return event;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await getOwnedEvent(session.user.id, params.id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await readJson(req);
  const parsed = eventFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const updated = await prisma.event.update({
    where: { id: params.id },
    data: {
      title: data.title,
      description: data.description,
      eventType: data.eventType,
      format: data.format,
      onlineUrl: data.onlineUrl ?? null,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      venueName: data.venueName,
      address: data.address,
      city: data.city,
      lat: data.lat,
      lng: data.lng,
      maxAttendees: data.maxAttendees,
      priceCents: data.priceCents,
      isPrivate: data.isPrivate,
      coverImageUrl: data.coverImageUrl,
    },
  });

  return NextResponse.json({ event: updated }, { status: 200 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await getOwnedEvent(session.user.id, params.id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.event.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true }, { status: 200 });
}
