import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerEvent } from "@/lib/pusher-server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { liveStreamChannelName, LIVE_CHAT_MESSAGE_EVENT } from "@/lib/live-stream-channels";

/**
 * Live-stream chat is broadcast-only and not persisted — it's a transient
 * companion to the video, not a record like room/event chat (lib/group-chat.ts).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const stream = await prisma.liveStream.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!stream || stream.status !== "live") {
    return NextResponse.json({ error: "This stream has ended." }, { status: 404 });
  }

  const limit = checkRateLimit(`live-chat:${profile.id}`, { limit: 20, windowMs: 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "You're sending messages too fast." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 300) : "";
  if (!content) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const message = {
    id: `${profile.id}-${Date.now()}`,
    content,
    sender: { username: profile.username, displayName: profile.displayName, avatarUrl: profile.avatarUrl },
    createdAt: new Date().toISOString(),
  };

  await triggerEvent(liveStreamChannelName(params.id), LIVE_CHAT_MESSAGE_EVENT, message);
  return NextResponse.json({ message }, { status: 201 });
}
