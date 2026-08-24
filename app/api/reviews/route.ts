import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isReviewContextType, submitReview } from "@/lib/reviews";

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
  const revieweeId = typeof body?.revieweeId === "string" ? body.revieweeId : null;
  const contextType = body?.contextType;
  const contextId = typeof body?.contextId === "string" ? body.contextId : null;
  const rating = typeof body?.rating === "number" ? body.rating : NaN;
  const comment = typeof body?.comment === "string" ? body.comment : "";

  if (!revieweeId || !isReviewContextType(contextType) || !contextId) {
    return NextResponse.json(
      { error: "revieweeId, contextType, and contextId are required" },
      { status: 400 }
    );
  }

  const result = await submitReview(profile.id, revieweeId, contextType, contextId, rating, comment);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ reviewId: result.reviewId }, { status: 201 });
}
