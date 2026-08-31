import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eventFormSchema } from "@/lib/validations/event";
import { readJson } from "@/lib/security/request";
import { isProviderProfileType } from "@/lib/provider-types";
import { hasIdentityOnFile } from "@/lib/verification";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, isSuspended: true, profileType: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.isSuspended) {
    return NextResponse.json(
      { error: "Your account is suspended from hosting events" },
      { status: 403 },
    );
  }
  if (!isProviderProfileType(profile.profileType)) {
    return NextResponse.json(
      {
        error: "Switch to a provider account before hosting events.",
        code: "PROVIDER_ACCOUNT_REQUIRED",
        actionHref: "/settings/account-type?intent=event",
      },
      { status: 403 },
    );
  }
  if (!(await hasIdentityOnFile(profile.id))) {
    return NextResponse.json(
      { error: "Verify your identity before creating an event." },
      { status: 403 },
    );
  }

  const body = await readJson(req);
  const parsed = eventFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const event = await prisma.event.create({
    data: {
      hostId: profile.id,
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

  return NextResponse.json({ event }, { status: 201 });
}
