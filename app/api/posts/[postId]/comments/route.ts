import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { flagContentIfNeeded } from "@/lib/moderation";
import { isActiveSubscriber } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/security/request";

const commentSchema = z.object({
  content: z.string().trim().min(1, "Comment can't be empty").max(1000, "Comments must be 1000 characters or fewer"),
  parentId: z.string().optional(),
});

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

function serializeComment(comment: {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; username: string; displayName: string; avatarUrl: string };
}) {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: comment.author,
    replies: [],
  };
}

export async function POST(req: Request, { params }: { params: { postId: string } }) {
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
    return NextResponse.json({ error: "Your account is suspended from commenting" }, { status: 403 });
  }

  const body = await readJson(req);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  let post: { id: string; authorId: string; isSubscriberOnly: boolean } | null;
  try {
    post = await prisma.post.findFirst({
      where: { id: params.postId, isArchived: false },
      select: { id: true, authorId: true, isSubscriberOnly: true },
    });
  } catch (error) {
    if (!isMissingPostArchiveError(error)) throw error;
    post = await prisma.post.findUnique({
      where: { id: params.postId },
      select: { id: true, authorId: true, isSubscriberOnly: true },
    });
  }
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (
    post.isSubscriberOnly &&
    post.authorId !== profile.id &&
    !(await isActiveSubscriber(profile.id, post.authorId))
  ) {
    return NextResponse.json({ error: "Subscribe to comment on this post" }, { status: 403 });
  }

  if (parsed.data.parentId) {
    const parent = await prisma.postComment.findUnique({
      where: { id: parsed.data.parentId },
      select: { postId: true },
    });
    if (!parent || parent.postId !== params.postId) {
      return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
    }
  }

  const comment = await prisma.postComment.create({
    data: {
      postId: params.postId,
      authorId: profile.id,
      parentId: parsed.data.parentId,
      content: parsed.data.content,
    },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  await flagContentIfNeeded({
    contentType: "post_comment",
    contentId: comment.id,
    contentOwnerId: profile.id,
    content: comment.content,
  });

  const count = await prisma.postComment.count({ where: { postId: params.postId } });
  return NextResponse.json({ comment: serializeComment(comment), count }, { status: 201 });
}
