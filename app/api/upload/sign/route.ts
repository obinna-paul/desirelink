import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { createSignedUploadParams } from "@/lib/cloudinary";
import { isCloudinaryConfigured } from "@/lib/uploads";

// Server-controlled folder + resource type (+ optional incoming transformation) per purpose -
// the client only ever picks a purpose, never a raw folder, so it can't sign an upload into an
// arbitrary Cloudinary path. One purpose per (folder, resourceType) pair since Cloudinary's
// upload endpoint is resource-type-specific (/image/upload vs /video/upload) and that has to
// match what was actually signed.
type PurposeConfig = { folder: string; resourceType: "image" | "video"; transformation?: string };

const PURPOSES: Record<string, PurposeConfig> = {
  "verification-selfie": { folder: "udala/verification/selfies", resourceType: "video" },
  "verification-id": { folder: "udala/verification/ids", resourceType: "image" },
  "post-image": { folder: "udala/posts", resourceType: "image", transformation: "c_limit,w_1600,h_1600" },
  "post-video": { folder: "udala/posts", resourceType: "video" },
  "message-image": { folder: "udala/messages", resourceType: "image", transformation: "c_limit,w_1800,h_1800" },
  // Cloudinary has no separate audio endpoint - audio uploads go through resource_type "video".
  "message-video": { folder: "udala/messages", resourceType: "video" },
  "message-audio": { folder: "udala/messages", resourceType: "video" },
};

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

  const signed = createSignedUploadParams({
    folder: config.folder,
    ...(config.transformation ? { transformation: config.transformation } : {}),
  });
  return NextResponse.json({ ...signed, resourceType: config.resourceType });
}
