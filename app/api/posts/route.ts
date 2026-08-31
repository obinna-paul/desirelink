import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { flagContentIfNeeded } from "@/lib/moderation";
import { getPostByIdForViewer } from "@/lib/posts";
import { createPostSchema } from "@/lib/validations/post";
import { readJson } from "@/lib/security/request";
import { isProviderProfileType } from "@/lib/provider-types";

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
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isSuspended: true,
      city: true,
      locationLat: true,
      locationLng: true,
      profileType: true,
    },
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

  const { content, isSubscriberOnly, postType, event } = parsed.data;
  const canPostPremiumContent = isProviderProfileType(profile.profileType);
  const mediaItems =
    parsed.data.mediaItems ??
    (parsed.data.mediaUrls ?? []).map((url) => ({ url, type: "image" as const }));
  const firstImage = mediaItems.find((item) => item.type === "image")?.url ?? "";

  let post: { id: string; content: string; mediaUrls: unknown; postType: "standard" | "event" | "live"; eventId: string | null; isSubscriberOnly: boolean; createdAt: Date };
  try {
    post = await prisma.$transaction(async (tx) => {
      const attachedEvent =
        postType === "event" && event
          ? await tx.event.create({
              data: {
                hostId: profile.id,
                title: event.title,
                description: content.trim() || event.title,
                eventType: event.eventType,
                startTime: new Date(event.startTime),
                endTime: new Date(event.endTime),
                venueName: event.venueName,
                address: event.address,
                city: event.city.trim() || profile.city,
                lat: event.lat ?? profile.locationLat,
                lng: event.lng ?? profile.locationLng,
                maxAttendees: event.maxAttendees,
                priceCents: event.priceCents,
                isPrivate: event.isPrivate,
                coverImageUrl: firstImage,
              },
            })
          : null;

      return tx.post.create({
        data: {
          authorId: profile.id,
          content: content.trim(),
          mediaUrls: mediaItems,
          postType,
          eventId: attachedEvent?.id,
          isSubscriberOnly: canPostPremiumContent ? isSubscriberOnly : false,
        },
      });
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
