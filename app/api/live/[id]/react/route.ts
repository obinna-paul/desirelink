import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerEvent } from "@/lib/pusher-server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { liveStreamChannelName, LIVE_REACTION_EVENT } from "@/lib/live-stream-channels";

/**
 * Free double-tap-to-heart reaction — no hearts spent, nothing persisted.
 * Purely a broadcast moment so every viewer sees the same burst.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const stream = await prisma.liveStream.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!stream || stream.status !== "live") {
    return NextResponse.json({ error: "This stream has ended." }, { status: 404 });
  }

  const limit = checkRateLimit(`live-react:${profile.id}`, { limit: 60, windowMs: 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  await triggerEvent(liveStreamChannelName(params.id), LIVE_REACTION_EVENT, { senderId: profile.id });
  return NextResponse.json({ ok: true });
}
