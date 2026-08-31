import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { flagContentIfNeeded } from "@/lib/moderation";
import { getPostByIdForViewer } from "@/lib/posts";
import { createPostSchema } from "@/lib/validations/post";
import { readJson } from "@/lib/security/request";

function isMissingSchemaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function missingPostSchemaMessage(error: Prisma.PrismaClientKnownRequestError) {
  const target = String(error.meta?.table ?? error.meta?.column ?? "post schema");
  if (target.includes("Post.postType") || target.includes("Post.eventId")) {
    return "Post creation needs the feed interaction database repair. Add Post.postType and Post.eventId in Neon SQL Editor.";
  }
  if (target.includes("Post.aspectRatio") || target.includes("PostAspectRatio")) {
    return "Post creation needs the aspect-ratio database repair. Run the add_post_aspect_ratio migration in Neon SQL Editor.";
  }
  if (target.includes("PostComment") || target.includes("PostReaction") || target.includes("PostShare")) {
    return "Post creation needs the post interaction tables repaired in Neon SQL Editor.";
  }
  if (target.includes("ModerationQueue")) {
    return "Post moderation needs the ModerationQueue table repaired in Neon SQL Editor.";
  }
  return "Post creation needs the database schema repair in Neon SQL Editor.";
}

export async function POST(req: Request) {
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
    return NextResponse.json({ error: "Your account is suspended from posting" }, { status: 403 });
  }

  const body = await readJson(req);
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { content, isSubscriberOnly, aspectRatio } = parsed.data;
  const mediaItems =
    parsed.data.mediaItems ??
    (parsed.data.mediaUrls ?? []).map((url) => ({ url, type: "image" as const }));

  let post: { id: string; content: string; mediaUrls: unknown; postType: "standard" | "event" | "live"; eventId: string | null; isSubscriberOnly: boolean; createdAt: Date };
  try {
    post = await prisma.post.create({
      data: {
        authorId: profile.id,
        content: content.trim(),
        mediaUrls: mediaItems,
        aspectRatio,
        isSubscriberOnly,
      },
    });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      console.error("[posts] create failed because the database schema is incomplete", error.meta);
      return NextResponse.json({ error: missingPostSchemaMessage(error) }, { status: 503 });
    }
    console.error("[posts] create failed", error);
    return NextResponse.json({ error: "Couldn't publish post. Please try again." }, { status: 500 });
  }

  try {
    await flagContentIfNeeded({
      contentType: "post",
      contentId: post.id,
      contentOwnerId: profile.id,
      content: post.content,
    });
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      console.error("[posts] moderation flagging failed after post creation", error);
    } else {
      console.warn("[posts] moderation skipped because the database schema is incomplete", error.meta);
    }
  }

  let hydrated = null;
  try {
    hydrated = await getPostByIdForViewer(post.id, profile.id);
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }
    console.warn("[posts] hydration skipped because the database schema is incomplete", error.meta);
  }

  return NextResponse.json({ post: hydrated }, { status: 201 });
}
