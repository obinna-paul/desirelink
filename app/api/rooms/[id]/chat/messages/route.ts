import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canPostInRoomChat } from "@/lib/rooms";
import { sendGroupMessage } from "@/lib/group-chat";

export async function POST(req: Request, { params }: { params: { id: string } }) {
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

  if (!(await canPostInRoomChat(params.id, profile.id))) {
    return NextResponse.json({ error: "Join this room to chat" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content : "";

  const result = await sendGroupMessage("room", params.id, profile.id, content);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ message: result.message }, { status: 201 });
}
