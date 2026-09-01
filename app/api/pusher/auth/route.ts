import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer, AVAILABILITY_CHANNEL } from "@/lib/pusher-server";
import { canAccessRoomChat } from "@/lib/rooms";
import { canAccessEventChat } from "@/lib/rsvp";

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
    select: { id: true, username: true, displayName: true, avatarUrl: true },
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

  // presence-room-{roomId}: anyone who can see the room's content may subscribe.
  if (channelName.startsWith("presence-room-")) {
    const roomId = channelName.slice("presence-room-".length);
    if (!(await canAccessRoomChat(roomId, profile.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
      user_id: profile.id,
      user_info: {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
    });
    return NextResponse.json(authResponse);
  }

  // presence-event-{eventId}: the host, or anyone RSVP'd "going", may subscribe.
  if (channelName.startsWith("presence-event-")) {
    const eventId = channelName.slice("presence-event-".length);
    if (!(await canAccessEventChat(eventId, profile.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
      user_id: profile.id,
      user_info: {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
    });
    return NextResponse.json(authResponse);
  }

  // presence-live-{streamId}: watching a live stream is public — anyone signed in may subscribe.
  if (channelName.startsWith("presence-live-")) {
    const streamId = channelName.slice("presence-live-".length);
    const stream = await prisma.liveStream.findUnique({ where: { id: streamId }, select: { status: true } });
    if (!stream || stream.status !== "live") {
      return NextResponse.json({ error: "Stream unavailable" }, { status: 403 });
    }
    const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
      user_id: profile.id,
      user_info: {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
    });
    return NextResponse.json(authResponse);
  }

  if (channelName.startsWith("private-live-host-")) {
    const streamId = channelName.slice("private-live-host-".length);
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      select: { providerId: true, status: true },
    });
    if (!stream || stream.providerId !== profile.id || stream.status !== "live") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(pusherServer.authorizeChannel(socketId, channelName));
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
