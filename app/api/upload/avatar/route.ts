import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { storeUpload } from "@/lib/uploads";
import { allowedImageTypesLabel, isAllowedImageFile } from "@/lib/security/uploads";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!isAllowedImageFile(file)) {
    return NextResponse.json(
      { error: `File must be ${allowedImageTypesLabel()}` },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { url } = await storeUpload({
      buffer,
      folder: "udala/avatars",
      publicId: session.user.id,
      contentType: file.type,
      transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face" }],
    });

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error("[upload/avatar] failed", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
