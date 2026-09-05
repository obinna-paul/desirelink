import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getBunnyPlaybackUrl, getBunnyThumbnailUrl, getBunnyVideoStatus } from "@/lib/bunny-stream";

/** Polled by the composer while a just-uploaded video transcodes - see
 * uploadVideoDirect in lib/client-uploads.ts. */
export async function GET(req: Request, { params }: { params: { videoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getBunnyVideoStatus(params.videoId);
  if (!status.ready) {
    return NextResponse.json({ ready: false }, { status: 200 });
  }

  return NextResponse.json(
    {
      ready: true,
      url: getBunnyPlaybackUrl(params.videoId),
      thumbnailUrl: getBunnyThumbnailUrl(params.videoId),
      width: status.width,
      height: status.height,
      durationSeconds: status.durationSeconds,
    },
    { status: 200 }
  );
}
