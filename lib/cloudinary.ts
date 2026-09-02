import { v2 as cloudinary } from "cloudinary";

// Cloudinary can be configured either as three separate vars (CLOUDINARY_CLOUD_NAME/
// API_KEY/API_SECRET) or as the single CLOUDINARY_URL the dashboard hands you by
// default (cloudinary://<api_key>:<api_secret>@<cloud_name>) — support both so
// isCloudinaryConfigured() (lib/uploads.ts) doesn't false-negative on a URL-only setup.
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

/**
 * Signs upload params for a direct browser-to-Cloudinary upload. Needed because Vercel's
 * Node.js serverless functions cap request bodies at ~4.5MB — a real phone-recorded video
 * (or even a several-MB photo) routed through our own API route as multipart form data gets
 * silently rejected by the platform before our handler ever runs, which the client sees as a
 * generic failed fetch. Signing here (api_secret never leaves the server) lets the browser
 * upload the file bytes straight to Cloudinary instead, bypassing that limit entirely.
 */
export function createSignedUploadParams(paramsToSign: Record<string, string | number>) {
  const config = cloudinary.config();
  if (!config.api_key || !config.api_secret || !config.cloud_name) {
    throw new Error("Cloudinary is not configured");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const fullParams = { ...paramsToSign, timestamp };
  const signature = cloudinary.utils.api_sign_request(fullParams, config.api_secret);

  return { ...fullParams, signature, apiKey: config.api_key, cloudName: config.cloud_name };
}

/** Pulls the public_id (folder path + filename, no extension) back out of a Cloudinary
 * secure_url, since we only ever persisted the URL - needed to delete an asset later. */
export function extractCloudinaryPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+(?:$|\?)/);
  return match ? match[1] : null;
}

/** Permanently deletes an uploaded asset - used to honor the "deleted immediately after
 * review" promise for verification documents. No-op if the URL isn't a recognizable
 * Cloudinary asset URL (e.g. the local-disk fallback used when Cloudinary isn't configured). */
export async function deleteCloudinaryAsset(url: string, resourceType: "image" | "video"): Promise<void> {
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
