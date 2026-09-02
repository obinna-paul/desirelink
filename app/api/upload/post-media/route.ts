import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { storeUpload, uploadErrorResponse } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";
import {
  allowedPostMediaTypesLabel,
  isAllowedImageFile,
  isAllowedPostMediaFile,
  isAllowedVideoFile,
} from "@/lib/security/uploads";

const MAX_IMAGE_SIZE = 30 * 1024 * 1024;
const MAX_VIDEO_SIZE = 300 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!isAllowedPostMediaFile(file)) {
    return NextResponse.json(
      { error: `File must be ${allowedPostMediaTypesLabel()}` },
      { status: 400 }
    );
  }

  const isVideo = isAllowedVideoFile(file);
  if (isAllowedImageFile(file) && file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: `Image must be under ${MAX_IMAGE_SIZE / (1024 * 1024)}MB` }, { status: 400 });
  }
  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    return NextResponse.json({ error: `Video must be under ${MAX_VIDEO_SIZE / (1024 * 1024)}MB` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const stored = await storeUpload({
      buffer,
      folder: "udala/posts",
      contentType: file.type,
      resourceType: isVideo ? "video" : "image",
      transformation: isVideo ? undefined : [{ width: 1600, height: 1600, crop: "limit" }],
    });

    return NextResponse.json(
      {
        media: {
          url: stored.url,
          type: isVideo ? "video" : "image",
          width: stored.width,
          height: stored.height,
          durationSeconds: stored.durationSeconds,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return uploadErrorResponse(error, "[upload/post-media]");
  }
}
