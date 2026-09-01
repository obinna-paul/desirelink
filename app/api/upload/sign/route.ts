import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { createSignedUploadParams } from "@/lib/cloudinary";
import { isCloudinaryConfigured } from "@/lib/uploads";

// Server-controlled folder + resource type per purpose - the client only ever picks a
// purpose, never a raw folder, so it can't sign an upload into an arbitrary Cloudinary path.
const PURPOSES = {
  "verification-selfie": { folder: "udala/verification/selfies", resourceType: "video" },
  "verification-id": { folder: "udala/verification/ids", resourceType: "image" },
} satisfies Record<string, { folder: string; resourceType: "image" | "video" }>;

export type UploadPurpose = keyof typeof PURPOSES;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Media storage isn't configured for this deployment." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const purpose = body?.purpose as string | undefined;
  const config = purpose ? PURPOSES[purpose as UploadPurpose] : undefined;
  if (!config) {
    return NextResponse.json({ error: "Invalid upload purpose" }, { status: 400 });
  }

  const signed = createSignedUploadParams({ folder: config.folder });
  return NextResponse.json({ ...signed, resourceType: config.resourceType });
}
