import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";

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

  const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
    user_id: profile.id,
    user_info: { displayName: profile.displayName },
  });

  return NextResponse.json(authResponse);
}
