import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getPersonalizedRecommendations } from "@/lib/recommendations";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit"));
  const recommendations = await getPersonalizedRecommendations(session.user.id, limit);

  if (!recommendations) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const res = NextResponse.json({ recommendations }, { status: 200 });
  res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=90");
  return res;
}
