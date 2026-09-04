import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { flagContentIfNeeded } from "@/lib/moderation";
import { getPostByIdForViewer } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/security/request";
import { updatePostSchema } from "@/lib/validations/post";

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

const MAX_PINNED_POSTS = 3;

async function getCurrentProfile(userId: string) {
  return prisma.profile.findUnique({
    where: { userId },
    select: { id: true, isSuspended: true },
  });
}

async function getOwnedPost(postId: string, profileId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, content: true, isSubscriberOnly: true, tierId: true },
  });

  if (!post)
    return {
      error: NextResponse.json({ error: "Post not found" }, { status: 404 }),
    };
  if (post.authorId !== profileId) {
    return {
      error: NextResponse.json(
        { error: "You can only manage posts you created" },
        { status: 403 },
      ),
    };
  }

  return { post };
}

export async function PATCH(
  req: Request,
  { params }: { params: { postId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getCurrentProfile(session.user.id);
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.isSuspended) {
    return NextResponse.json(
      { error: "Your account is suspended from managing posts" },
      { status: 403 },
    );
  }

  const owned = await getOwnedPost(params.postId, profile.id);
  if ("error" in owned) return owned.error;

  const body = await readJson(req);
  const parsed = updatePostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  if (parsed.data.action === "archive") {
    try {
      await prisma.post.update({
        where: { id: params.postId },
        data: { isArchived: true },
      });
    } catch (error) {
      if (isMissingPostArchiveError(error)) {
        return NextResponse.json(
          {
            error:
              "Post archiving needs the Post.isArchived database migration in Neon SQL Editor.",
          },
          { status: 503 },
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true, archived: true });
  }

  if (parsed.data.action === "pin") {
    const pinnedCount = await prisma.post.count({
      where: { authorId: profile.id, pinnedAt: { not: null } },
    });
    if (pinnedCount >= MAX_PINNED_POSTS) {
      return NextResponse.json(
        {
          error: `You can only pin up to ${MAX_PINNED_POSTS} posts. Unpin one first.`,
        },
        { status: 409 },
      );
    }

    await prisma.post.update({
      where: { id: params.postId },
      data: { pinnedAt: new Date() },
    });
    return NextResponse.json({ ok: true, pinned: true });
  }

  if (parsed.data.action === "unpin") {
    await prisma.post.update({
      where: { id: params.postId },
      data: { pinnedAt: null },
    });
    return NextResponse.json({ ok: true, pinned: false });
  }

  const updateData: Prisma.PostUpdateInput = { content: parsed.data.content };
  if (parsed.data.isSubscriberOnly !== undefined) {
    updateData.isSubscriberOnly = parsed.data.isSubscriberOnly;
    const wasSubscriberOnly = owned.post.isSubscriberOnly;

    if (!parsed.data.isSubscriberOnly) {
      updateData.tier = { disconnect: true };
    } else if (parsed.data.tierId) {
      const tier = await prisma.creatorTier.findUnique({
        where: { id: parsed.data.tierId },
        select: { creatorId: true },
      });
      if (!tier || tier.creatorId !== profile.id) {
        return NextResponse.json({ error: "Tier not found." }, { status: 404 });
      }
      updateData.tier = { connect: { id: parsed.data.tierId } };
    } else if (!wasSubscriberOnly) {
      // Turning a free post Premium without an explicit tier choice (the older
      // switch-only edit UI) - fall back to the cheapest tier, same rule the
      // per-tier-gating migration used to backfill posts made before tiers existed.
      // A post that was ALREADY Premium and stays Premium with no tierId sent keeps
      // its existing tier untouched - editing the caption must never quietly downgrade
      // which tier a post requires.
      const cheapestTier = await prisma.creatorTier.findFirst({
        where: { creatorId: profile.id },
        orderBy: { priceCents: "asc" },
        select: { id: true },
      });
      if (!cheapestTier) {
        return NextResponse.json(
          { error: "Set up a subscription tier before making a post Premium." },
          { status: 400 },
        );
      }
      updateData.tier = { connect: { id: cheapestTier.id } };
    }
  }

  await prisma.post.update({
    where: { id: params.postId },
    data: updateData,
  });

  try {
    await flagContentIfNeeded({
      contentType: "post",
      contentId: params.postId,
      contentOwnerId: profile.id,
      content: parsed.data.content,
    });
  } catch (error) {
    console.warn("[posts] moderation flagging failed after post edit", error);
  }

  const post = await getPostByIdForViewer(params.postId, profile.id);
  return NextResponse.json({ post });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { postId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getCurrentProfile(session.user.id);
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.isSuspended) {
    return NextResponse.json(
      { error: "Your account is suspended from managing posts" },
      { status: 403 },
    );
  }

  const owned = await getOwnedPost(params.postId, profile.id);
  if ("error" in owned) return owned.error;

  await prisma.post.delete({ where: { id: params.postId } });
  return NextResponse.json({ ok: true, deleted: true });
}
