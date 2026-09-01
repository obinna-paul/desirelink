import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  acceptServiceBooking,
  cancelServiceBooking,
  completeServiceBooking,
  declineServiceBooking,
} from "@/lib/service-bookings";

const ACTIONS = ["accept", "decline", "cancel", "complete"] as const;
type Action = (typeof ACTIONS)[number];

function isAction(value: unknown): value is Action {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

/** Provider accept/decline, or customer cancel/complete, on a single service booking — see lib/service-bookings.ts for the escrow logic behind each action. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

  const body = await req.json().catch(() => null);
  if (!isAction(body?.action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const reason = typeof body?.reason === "string" ? body.reason : "";

  const result = await (async () => {
    switch (body.action as Action) {
      case "accept":
        return acceptServiceBooking(params.id, profile.id);
      case "decline":
        return declineServiceBooking(params.id, profile.id, reason);
      case "cancel":
        return cancelServiceBooking(params.id, profile.id);
      case "complete":
        return completeServiceBooking(params.id, profile.id);
    }
  })();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ booking: result.booking }, { status: 200 });
}
