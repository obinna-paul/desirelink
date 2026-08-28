import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/security/request";

const shareSchema = z.object({
  target: z.enum(["copy_link", "web_share", "internal_message"]).default("copy_link"),
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
    return NextResponse.json({ error: "Your account is suspended from sharing" }, { status: 403 });
  }

  const body = await readJson(req);
  const parsed = shareSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid share target" }, { status: 400 });
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
    return NextResponse.json({ error: "Subscribe to share this post" }, { status: 403 });
  }

  await prisma.postShare.create({
    data: { postId: params.postId, userId: profile.id, target: parsed.data.target },
  });

  const count = await prisma.postShare.count({ where: { postId: params.postId } });
  return NextResponse.json({ count }, { status: 201 });
}
