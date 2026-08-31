import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRsvpAction, setRsvp } from "@/lib/rsvp";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!isRsvpAction(body?.status)) {
    return NextResponse.json({ error: "Invalid RSVP status" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const returnUrl = `${origin}/events/${params.id}`;

  const result = await setRsvp(profile.id, params.id, body.status, { successUrl: returnUrl, cancelUrl: returnUrl });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.state === "checkout") {
    return NextResponse.json({ state: result.state, checkoutUrl: result.checkoutUrl }, { status: 200 });
  }
  if (body.status === "going" || body.status === "interested") {
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      select: { hostId: true, title: true },
    });
    if (event) {
      await createNotification({
        recipientId: event.hostId,
        actorId: profile.id,
        type: "rsvp",
        title: `${profile.displayName} responded to your event`,
        body: `${body.status === "going" ? "Going to" : "Interested in"} ${event.title}`,
        href: `/events/${params.id}`,
      });
    }
  }
  return NextResponse.json({ state: result.state, status: result.status, message: result.message }, { status: 200 });
}
