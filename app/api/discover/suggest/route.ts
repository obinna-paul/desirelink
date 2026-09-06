import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { suggestDiscoverProfiles } from "@/lib/discover";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  const results = await suggestDiscoverProfiles(query, profile?.id ?? null);

  return NextResponse.json({ results });
}
