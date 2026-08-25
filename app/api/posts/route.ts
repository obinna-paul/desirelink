import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { flagContentIfNeeded } from "@/lib/moderation";
import { createPostSchema } from "@/lib/validations/post";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, username: true, displayName: true, avatarUrl: true, profileType: true, isSuspended: true },
  });

  if (profile?.profileType !== "CREATOR") {
    return NextResponse.json({ error: "Creator access required" }, { status: 403 });
  }
  if (profile.isSuspended) {
    return NextResponse.json({ error: "Your account is suspended from posting" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { content, mediaUrls, isSubscriberOnly } = parsed.data;

  const post = await prisma.post.create({
    data: {
      authorId: profile.id,
      content: content.trim(),
      mediaUrls,
      isSubscriberOnly,
    },
  });
  await flagContentIfNeeded({
    contentType: "post",
    contentId: post.id,
    contentOwnerId: profile.id,
    content: post.content,
  });

  return NextResponse.json(
    {
      post: {
        id: post.id,
        content: post.content,
        mediaUrls,
        isSubscriberOnly: post.isSubscriberOnly,
        locked: false,
        createdAt: post.createdAt.toISOString(),
        author: {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
      },
    },
    { status: 201 }
  );
}
