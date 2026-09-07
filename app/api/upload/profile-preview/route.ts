import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";

import { authOptions } from "@/lib/auth";
import { cloudinary } from "@/lib/cloudinary";
import { storeUpload, uploadErrorResponse } from "@/lib/uploads";

const FIRST_PARTY_MAX_BYTES = 3.5 * 1024 * 1024;
const NORMALIZABLE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !NORMALIZABLE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported photo" }, { status: 400 });
  }
  if (file.size > FIRST_PARTY_MAX_BYTES) {
    return NextResponse.json({ error: "Use direct normalization" }, { status: 413 });
  }

  const assetId = `${session.user.id}/${randomUUID()}`;
  try {
    const stored = await storeUpload({
      buffer: Buffer.from(await file.arrayBuffer()),
      folder: "udala/profile-previews",
      publicId: assetId,
      contentType: file.type,
      transformation: [{ width: 2400, height: 2400, crop: "limit", quality: "auto:good" }],
      format: "jpg",
    });
    return NextResponse.json({
      url: stored.url,
      publicId: `udala/profile-previews/${assetId}`,
    });
  } catch (error) {
    return uploadErrorResponse(error, "[upload/profile-preview]");
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const publicId = typeof body?.publicId === "string" ? body.publicId : "";
  const ownedPrefix = `udala/profile-previews/${session.user.id}/`;
  if (!publicId.startsWith(ownedPrefix)) {
    return NextResponse.json({ error: "Invalid preview" }, { status: 400 });
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[upload/profile-preview] cleanup failed", error);
    return NextResponse.json({ error: "Preview cleanup failed" }, { status: 502 });
  }
}
