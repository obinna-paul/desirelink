import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/messages";
import { isProviderProfileType } from "@/lib/provider-types";
import { trackMessageReply } from "@/lib/rewards/tracking";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, profileType: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const recipientId = typeof body?.recipientId === "string" ? body.recipientId : null;
  const content = typeof body?.content === "string" ? body.content : null;

  if (!recipientId || !content) {
    return NextResponse.json({ error: "recipientId and content are required" }, { status: 400 });
  }

  const result = await sendMessage(profile.id, recipientId, content);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (isProviderProfileType(profile.profileType)) {
    const priorMessageFromRecipient = await prisma.message.findFirst({
      where: { senderId: recipientId, recipientId: profile.id },
      select: { id: true },
    });
    if (priorMessageFromRecipient) {
      await trackMessageReply(profile.id, recipientId);
    }
  }

  return NextResponse.json({ message: result.message }, { status: 201 });
}
