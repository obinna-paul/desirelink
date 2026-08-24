import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEventHost } from "@/lib/rsvp";
import { deleteGroupMessage } from "@/lib/group-chat";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; messageId: string } }
) {
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

  if (!(await isEventHost(params.id, profile.id))) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const result = await deleteGroupMessage("event", params.id, params.messageId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
