import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

function isMissingPostArchiveError(error: unknown): boolean {
  const target =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? String(error.meta?.table ?? error.meta?.column ?? "")
      : "";

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    (target.includes("Post.isArchived") || target.includes("isArchived"))
  );
}

export async function POST(_req: Request, { params }: { params: { postId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, isSuspended: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.isSuspended) {
    return NextResponse.json({ error: "Your account is suspended from reacting" }, { status: 403 });
  }

  let post: { authorId: string; isSubscriberOnly: boolean; author: { username: string } } | null;
  try {
    post = await prisma.post.findFirst({
      where: { id: params.postId, isArchived: false },
      select: { authorId: true, isSubscriberOnly: true, author: { select: { username: true } } },
    });
  } catch (error) {
    if (!isMissingPostArchiveError(error)) throw error;
    post = await prisma.post.findUnique({
      where: { id: params.postId },
      select: { authorId: true, isSubscriberOnly: true, author: { select: { username: true } } },
    });
  }
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
    await createNotification({
      recipientId: post.authorId,
      actorId: profile.id,
      type: "like",
      title: `${profile.displayName} liked your post`,
      body: "Open your profile to see the activity.",
      href: `/profile/${post.author.username}`,
    });
  }

  const count = await prisma.postReaction.count({ where: { postId: params.postId, type: "like" } });
  return NextResponse.json({ liked: !existing, count });
}
