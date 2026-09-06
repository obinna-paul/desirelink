import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: { postId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    select: { authorId: true, viewCount: true },
  });
  if (!post)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (post.authorId === profile.id) {
    return NextResponse.json({ counted: false, count: post.viewCount });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.postImpression.create({
        data: { postId: params.postId, viewerId: profile.id },
      });
      return tx.post.update({
        where: { id: params.postId },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true },
      });
    });

    return NextResponse.json({ counted: true, count: updated.viewCount });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const current = await prisma.post.findUnique({
        where: { id: params.postId },
        select: { viewCount: true },
      });
      return NextResponse.json({ counted: false, count: current?.viewCount ?? post.viewCount });
    }
    throw error;
  }
}
