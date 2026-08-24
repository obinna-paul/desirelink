import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { buildPermissionFieldNames, getOwnedCircles } from "@/lib/circles";
import { prisma } from "@/lib/prisma";
import { createCircleSchema } from "@/lib/validations/circle";

async function getSessionProfile() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
}

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const circles = await getOwnedCircles(profile.id);
  return NextResponse.json({ circles }, { status: 200 });
}

export async function POST(req: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createCircleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const existing = await prisma.circle.findFirst({
    where: { userId: profile.id, name: parsed.data.name },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ error: "You already have a circle with that name." }, { status: 409 });
  }

  const circle = await prisma.circle.create({
    data: {
      userId: profile.id,
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: {
        create: buildPermissionFieldNames({
          profileFields: parsed.data.profileFields,
          desireCategories: parsed.data.desireCategories,
        }).map((fieldName) => ({ fieldName, visible: true })),
      },
    },
    include: {
      members: {
        include: {
          profile: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      permissions: { orderBy: { fieldName: "asc" } },
    },
  });

  return NextResponse.json({ circle }, { status: 201 });
}
