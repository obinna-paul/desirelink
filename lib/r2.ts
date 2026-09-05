import "server-only";

import { randomBytes } from "crypto";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 holds feed-post video only - everything else (avatars, banners,
 * verification docs, message media, and feed-post images) stays on Cloudinary, which
 * still does real work for those: server-enforced resizing on images, HEIC conversion,
 * and immediate deletion for verification compliance. R2 has none of that, but it has
 * zero egress fees, which matters specifically for video - the same large file gets
 * re-served on every scroll-past in a feed, and Cloudinary adds no processing value here
 * today (no poster/thumbnail generation is in use - see components/posts/post-video-player.tsx).
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_ENDPOINT &&
      process.env.CLOUDFLARE_R2_BUCKET &&
      process.env.CLOUDFLARE_R2_PUBLIC_URL
  );
}

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  cachedClient = new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  });
  return cachedClient;
}

const EXTENSION_BY_VIDEO_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** A fresh, unguessable object key under posts/ - random rather than content-derived so
 * two different uploads never collide even if the same file gets posted twice. */
export function generatePostVideoKey(contentType: string): string {
  const ext = EXTENSION_BY_VIDEO_TYPE[contentType] ?? "mp4";
  return `posts/${randomBytes(16).toString("hex")}.${ext}`;
}

/** A presigned PUT URL the browser uploads the raw file bytes to directly - same
 * "bypass our own server's body-size limit" reasoning as Cloudinary's signed uploads
 * (see lib/client-uploads.ts), just via S3's presigned-URL mechanism instead of a
 * signature-plus-form-fields one. Expires in 5 minutes - long enough to start a large
 * upload, short enough that a leaked URL isn't useful for long. */
export async function createR2UploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: 300 });
}

export function getR2PublicUrl(key: string): string {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL!.replace(/\/+$/, "");
  return `${base}/${key}`;
}

/** Not currently wired into post deletion - Cloudinary post media isn't cleaned up on
 * post delete either (see app/api/posts/[postId]/route.ts), so this stays consistent
 * with that existing behavior. Kept for whenever that changes. */
export async function deleteR2Object(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET, Key: key }));
}
