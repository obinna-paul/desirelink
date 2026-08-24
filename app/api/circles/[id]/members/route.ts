import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addCircleMemberSchema } from "@/lib/validations/circle";

async function getSessionProfile() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ownerProfile = await getSessionProfile();
  if (!ownerProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = addCircleMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const circle = await prisma.circle.findFirst({
    where: { id: params.id, userId: ownerProfile.id },
    select: { id: true },
  });

  if (!circle) {
    return NextResponse.json({ error: "Circle not found" }, { status: 404 });
  }

  const memberProfile = await prisma.profile.findUnique({
    where: { username: parsed.data.username },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });

  if (!memberProfile) {
    return NextResponse.json({ error: "No profile found for that username." }, { status: 404 });
  }

  if (memberProfile.id === ownerProfile.id) {
    return NextResponse.json({ error: "Your own profile is always fully visible to you." }, { status: 400 });
  }

  const existing = await prisma.circleMember.findFirst({
    where: { circleId: params.id, userId: memberProfile.id },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ error: "This member is already in the circle." }, { status: 409 });
  }

  const member = await prisma.circleMember.create({
    data: { circleId: params.id, userId: memberProfile.id },
    include: {
      profile: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}
