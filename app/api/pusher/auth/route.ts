import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, AVAILABILITY_CHANNEL } from "@/lib/pusher-server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!pusherServer) {
    return NextResponse.json({ error: "Realtime is not configured" }, { status: 503 });
  }

  const body = await req.formData();
  const socketId = body.get("socket_id")?.toString();
  const channelName = body.get("channel_name")?.toString();

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (channelName === AVAILABILITY_CHANNEL) {
    const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
      user_id: profile.id,
      user_info: { displayName: profile.displayName },
    });
    return NextResponse.json(authResponse);
  }

  // private-conversation-{profileIdA}-{profileIdB} (ids are hyphen-free cuids,
  // sorted — see lib/message-channels.ts): only the two participants may subscribe.
  if (channelName.startsWith("private-conversation-")) {
    const ids = channelName.slice("private-conversation-".length).split("-");
    if (ids.length !== 2 || !ids.includes(profile.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  }

  // private-user-{profileId}: only that user may subscribe to their own inbox channel.
  if (channelName.startsWith("private-user-")) {
    const targetId = channelName.slice("private-user-".length);
    if (targetId !== profile.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  }

  return NextResponse.json({ error: "Unknown channel" }, { status: 403 });
}
