import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { flagContentIfNeeded } from "@/lib/moderation";
import { getPostByIdForViewer } from "@/lib/posts";
import { isProviderProfileType } from "@/lib/provider-types";
import { createPostSchema } from "@/lib/validations/post";
import { readJson } from "@/lib/security/request";

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
      profileType: true,
      isSuspended: true,
      city: true,
      locationLat: true,
      locationLng: true,
    },
  });

  if (!profile || !isProviderProfileType(profile.profileType)) {
    return NextResponse.json({ error: "Provider access required" }, { status: 403 });
  }
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
  const mediaItems =
    parsed.data.mediaItems ??
    (parsed.data.mediaUrls ?? []).map((url) => ({ url, type: "image" as const }));
  const firstImage = mediaItems.find((item) => item.type === "image")?.url ?? "";

  const post = await prisma.$transaction(async (tx) => {
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
        isSubscriberOnly,
      },
    });
  });

  await flagContentIfNeeded({
    contentType: "post",
    contentId: post.id,
    contentOwnerId: profile.id,
    content: post.content,
  });

  const hydrated = await getPostByIdForViewer(post.id, profile.id);
  return NextResponse.json({ post: hydrated }, { status: 201 });
}
