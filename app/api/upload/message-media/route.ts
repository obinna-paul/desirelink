import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedAudioFile, isAllowedImageFile, isAllowedVideoFile } from "@/lib/security/uploads";
import { storeUpload, uploadErrorResponse } from "@/lib/uploads";

const MAX_IMAGE_SIZE = 30 * 1024 * 1024;
const MAX_VIDEO_SIZE = 300 * 1024 * 1024;
const MAX_AUDIO_SIZE = 20 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { isSuspended: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.isSuspended) {
    return NextResponse.json({ error: "Your account is suspended from uploading media" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const isImage = isAllowedImageFile(file);
  const isVideo = isAllowedVideoFile(file);
  const isAudio = isAllowedAudioFile(file);
  if (!isImage && !isVideo && !isAudio) {
    return NextResponse.json({ error: "Choose a supported photo, video, or audio file" }, { status: 400 });
  }
  if (isImage && file.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: `Photo must be under ${MAX_IMAGE_SIZE / (1024 * 1024)}MB` }, { status: 400 });
  if (isVideo && file.size > MAX_VIDEO_SIZE) return NextResponse.json({ error: `Video must be under ${MAX_VIDEO_SIZE / (1024 * 1024)}MB` }, { status: 400 });
  if (isAudio && file.size > MAX_AUDIO_SIZE) return NextResponse.json({ error: `Voice note must be under ${MAX_AUDIO_SIZE / (1024 * 1024)}MB` }, { status: 400 });

  try {
    const stored = await storeUpload({
      buffer: Buffer.from(await file.arrayBuffer()),
      folder: "udala/messages",
      contentType: file.type,
      resourceType: isImage ? "image" : "video",
      transformation: isImage ? [{ width: 1800, height: 1800, crop: "limit" }] : undefined,
    });

    return NextResponse.json({
      media: {
        url: stored.url,
        type: isImage ? "image" : isVideo ? "video" : "audio",
        mimeType: file.type,
        width: stored.width,
        height: stored.height,
        durationSeconds: stored.durationSeconds,
      },
    });
  } catch (error) {
    return uploadErrorResponse(error, "[upload/message-media]");
  }
}
