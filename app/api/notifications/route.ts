import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getNotifications, markNotificationsRead } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/security/request";

async function getProfileId(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profileId = await getProfileId(session.user.id);
  if (!profileId) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const notifications = await getNotifications(profileId);
  return NextResponse.json(notifications, { status: 200 });
}

const readSchema = z.object({ id: z.string().optional() });

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profileId = await getProfileId(session.user.id);
  if (!profileId) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const parsed = readSchema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await markNotificationsRead(profileId, parsed.data.id);
  return NextResponse.json({ ok: true });
}
