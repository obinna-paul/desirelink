import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBlockedEitherWay } from "@/lib/block";
import { getConversationChannelName, TYPING_EVENT } from "@/lib/message-channels";
import { triggerEvent } from "@/lib/pusher-server";

export async function POST(req: Request) {
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
  const recipientId = typeof body?.recipientId === "string" ? body.recipientId : null;
  const isTyping = body?.isTyping === true;
  if (!recipientId || recipientId === profile.id) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
  }
  if (await isBlockedEitherWay(profile.id, recipientId)) {
    return NextResponse.json({ error: "Messaging unavailable" }, { status: 403 });
  }

  await triggerEvent(getConversationChannelName(profile.id, recipientId), TYPING_EVENT, {
    profileId: profile.id,
    isTyping,
  });
  return new NextResponse(null, { status: 204 });
}
