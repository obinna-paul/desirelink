import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { buildPermissionRows, CIRCLE_INCLUDE } from "@/lib/circles";
import { prisma } from "@/lib/prisma";
import { updateCircleSchema } from "@/lib/validations/circle";

async function getSessionProfile() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateCircleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const circle = await prisma.circle.findFirst({
    where: { id: params.id, userId: profile.id },
    select: { id: true },
  });

  if (!circle) {
    return NextResponse.json({ error: "Circle not found" }, { status: 404 });
  }

  const duplicate = await prisma.circle.findFirst({
    where: {
      userId: profile.id,
      name: parsed.data.name,
      NOT: { id: params.id },
    },
    select: { id: true },
  });

  if (duplicate) {
    return NextResponse.json({ error: "You already have a circle with that name." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.circle.update({
      where: { id: params.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
    }),
    prisma.circlePermission.deleteMany({ where: { circleId: params.id } }),
    ...(parsed.data.profileFields.length + parsed.data.desireCategories.length > 0
      ? [
          prisma.circlePermission.createMany({
            data: buildPermissionRows(params.id, {
              profileFields: parsed.data.profileFields,
              desireCategories: parsed.data.desireCategories,
            }),
          }),
        ]
      : []),
  ]);

  const updated = await prisma.circle.findUnique({
    where: { id: params.id },
    include: CIRCLE_INCLUDE,
  });

  return NextResponse.json({ circle: updated }, { status: 200 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const circle = await prisma.circle.findFirst({
    where: { id: params.id, userId: profile.id },
    select: { id: true },
  });

  if (!circle) {
    return NextResponse.json({ error: "Circle not found" }, { status: 404 });
  }

  await prisma.circle.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
