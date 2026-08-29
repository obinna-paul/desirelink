import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { cloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import {
  allowedPostMediaTypesLabel,
  isAllowedImageFile,
  isAllowedPostMediaFile,
  isAllowedVideoFile,
} from "@/lib/security/uploads";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

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
    return NextResponse.json({ error: "Image must be under 8MB" }, { status: 400 });
  }
  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    return NextResponse.json({ error: "Video must be under 100MB" }, { status: 400 });
  }

  if (!hasCloudinaryConfig()) {
    console.error("[post-media] Cloudinary environment variables are missing.");
    return NextResponse.json(
      { error: "Media uploads need Cloudinary keys configured in Vercel." },
      { status: 503 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await new Promise<{ secure_url: string; width?: number; height?: number; duration?: number }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "udala/posts",
            resource_type: "auto",
            transformation: isVideo ? undefined : [{ width: 1600, height: 1600, crop: "limit" }],
          },
          (error, result) => {
            if (error || !result) return reject(error ?? new Error("Upload failed"));
            resolve(result);
          }
        );
        uploadStream.end(buffer);
      }
    );

    return NextResponse.json(
      {
        media: {
          url: result.secure_url,
          type: isVideo ? "video" : "image",
          width: result.width,
          height: result.height,
          durationSeconds: result.duration,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[post-media] Cloudinary upload failed", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
