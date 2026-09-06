import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBunnyVideo, isBunnyStreamConfigured, signBunnyUpload } from "@/lib/bunny-stream";
import {
  inferVideoContentType,
  MAX_VIDEO_UPLOAD_BYTES,
} from "@/lib/video-upload-constraints";

/** Creates a Bunny Stream video object and returns a signed one-time TUS upload
 * authorization for it - never the API key itself. Mirrors the auth/suspension checks
 * on the (now unused-for-video) R2 sign route. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBunnyStreamConfigured()) {
    return NextResponse.json({ error: "Video storage isn't configured for this deployment." }, { status: 503 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { isSuspended: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.isSuspended) {
    return NextResponse.json({ error: "Your account is suspended from uploading media" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (body?.purpose !== "post-video") {
    return NextResponse.json({ error: "Invalid upload purpose" }, { status: 400 });
  }

  if (
    !Number.isFinite(body?.fileSize) ||
    body.fileSize <= 0 ||
    body.fileSize > MAX_VIDEO_UPLOAD_BYTES
  ) {
    return NextResponse.json({ error: "Videos can be up to 2GB." }, { status: 413 });
  }

  const fileName = typeof body?.fileName === "string" ? body.fileName : "video";
  const contentType = inferVideoContentType(fileName, body?.contentType);
  if (!contentType) {
    return NextResponse.json(
      { error: "Choose a supported video file." },
      { status: 415 },
    );
  }

  try {
    const safeFileName =
      typeof body.fileName === "string"
        ? body.fileName.replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 80)
        : "video";
    const videoId = await createBunnyVideo(`post-${session.user.id}-${Date.now()}-${safeFileName}`);
    const auth = signBunnyUpload(videoId);
    return NextResponse.json({ ...auth, contentType }, { status: 200 });
  } catch (error) {
    console.error("[upload/bunny-sign] failed to create video", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
