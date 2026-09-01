import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBlockedEitherWay } from "@/lib/block";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profileId = new URL(req.url).searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const viewer = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!viewer) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (viewer.id === profileId || (await isBlockedEitherWay(viewer.id, profileId))) {
    return NextResponse.json({ visible: false, state: "hidden", lastActiveAt: null });
  }

  let profile: { lastActiveAt: Date | null; showActivityStatus: boolean } | null;
  try {
    profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { lastActiveAt: true, showActivityStatus: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return NextResponse.json({ visible: false, state: "hidden", lastActiveAt: null });
    }
    throw error;
  }
  if (!profile?.showActivityStatus || !profile.lastActiveAt) {
    return NextResponse.json({ visible: false, state: "hidden", lastActiveAt: null });
  }

  const online = Date.now() - profile.lastActiveAt.getTime() <= ONLINE_WINDOW_MS;
  return NextResponse.json({
    visible: true,
    state: online ? "online" : "offline",
    lastActiveAt: profile.lastActiveAt.toISOString(),
  });
}
