import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/posts";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { postId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, isSuspended: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.isSuspended) {
    return NextResponse.json({ error: "Your account is suspended from reacting" }, { status: 403 });
  }

  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    select: { authorId: true, isSubscriberOnly: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (
    post.isSubscriberOnly &&
    post.authorId !== profile.id &&
    !(await isActiveSubscriber(profile.id, post.authorId))
  ) {
    return NextResponse.json({ error: "Subscribe to like this post" }, { status: 403 });
  }

  const existing = await prisma.postReaction.findUnique({
    where: { postId_userId_type: { postId: params.postId, userId: profile.id, type: "like" } },
    select: { id: true },
  });

  if (existing) {
    await prisma.postReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.postReaction.create({
      data: { postId: params.postId, userId: profile.id, type: "like" },
    });
  }

  const count = await prisma.postReaction.count({ where: { postId: params.postId, type: "like" } });
  return NextResponse.json({ liked: !existing, count });
}
