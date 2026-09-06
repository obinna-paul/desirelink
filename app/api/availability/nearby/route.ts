import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getNearbyActiveSnapshot } from "@/lib/availability";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewer = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, locationLat: true, locationLng: true },
  });
  if (!viewer) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const snapshot = await getNearbyActiveSnapshot(viewer);
  const response = NextResponse.json(snapshot);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
