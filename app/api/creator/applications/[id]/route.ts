import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorProfileByUserId } from "@/lib/creator";
import { readJson } from "@/lib/security/request";

const reviewSchema = z.object({ status: z.enum(["approved", "denied"]) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const creatorProfile = await getCreatorProfileByUserId(session.user.id);
  if (!creatorProfile) {
    return NextResponse.json({ error: "Profile required" }, { status: 403 });
  }

  const application = await prisma.accessApplication.findUnique({
    where: { id: params.id },
    include: { tier: { select: { creatorId: true } } },
  });

  if (!application || application.tier.creatorId !== creatorProfile.id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (application.status !== "pending") {
    return NextResponse.json({ error: "This application was already reviewed" }, { status: 400 });
  }

  const body = await readJson(req);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.accessApplication.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ application: updated }, { status: 200 });
}
