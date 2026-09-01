import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import type { ConversationMedia, ConversationMediaType } from "@/lib/message-types";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/messages";

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
  const content = typeof body?.content === "string" ? body.content : "";
  const replyToId = typeof body?.replyToId === "string" ? body.replyToId : null;
  const mediaType = ["image", "video", "audio"].includes(body?.media?.type)
    ? (body.media.type as ConversationMediaType)
    : null;
  const media: ConversationMedia | null = mediaType && typeof body?.media?.url === "string"
    ? {
        url: body.media.url,
        type: mediaType,
        mimeType: typeof body.media.mimeType === "string" ? body.media.mimeType : null,
        width: Number.isFinite(body.media.width) ? Math.round(body.media.width) : null,
        height: Number.isFinite(body.media.height) ? Math.round(body.media.height) : null,
        durationSeconds: Number.isFinite(body.media.durationSeconds) ? body.media.durationSeconds : null,
      }
    : null;

  if (!recipientId || (!content.trim() && !media)) {
    return NextResponse.json({ error: "recipientId and a message or attachment are required" }, { status: 400 });
  }

  const result = await sendMessage(profile.id, recipientId, content, replyToId, media);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ message: result.message }, { status: 201 });
}
