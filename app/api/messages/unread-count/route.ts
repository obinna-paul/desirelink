import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getUnreadConversationCount } from "@/lib/messages";
import { prisma } from "@/lib/prisma";

/** Backs the unread-message counter badge on the Messages nav icon - see
 * lib/use-unread-message-count.ts. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const count = await getUnreadConversationCount(profile.id);
  return NextResponse.json({ count }, { status: 200 });
}
