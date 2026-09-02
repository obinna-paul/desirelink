/**
 * Uploads a file directly from the browser to Cloudinary using a short-lived signature
 * from our server, bypassing our own API route entirely for the actual file bytes. This
 * matters because Vercel's serverless functions cap request bodies at ~4.5MB - a real
 * phone-recorded video (or even a several-MB photo) posted as multipart form data to our
 * own route gets silently rejected by the platform before our handler runs, which shows up
 * to the user as a generic "Upload failed" with no useful detail.
 *
 * Falls back to `fallbackUrl` (one of our own multipart routes, which uses local disk
 * storage in dev) when Cloudinary isn't configured for this deployment - keeps local
 * development working without requiring Cloudinary credentials.
 */

type SignedUpload = {
  apiKey: string;
  cloudName: string;
  folder: string;
  timestamp: number;
  signature: string;
  transformation?: string;
  resourceType: "image" | "video";
};

type CloudinaryUploadResult = {
  url: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

async function requestSignature(purpose: string): Promise<SignedUpload | null> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose }),
  });

  if (signRes.status === 503) return null;

  if (!signRes.ok) {
    const body = await signRes.json().catch(() => null);
    throw new Error(body?.error ?? "Upload failed. Please try again.");
  }

  return signRes.json();
}

async function postDirectToCloudinary(file: File, sign: SignedUpload): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sign.apiKey);
  formData.append("timestamp", String(sign.timestamp));
  formData.append("signature", sign.signature);
  formData.append("folder", sign.folder);
  if (sign.transformation) formData.append("transformation", sign.transformation);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`, {
    method: "POST",
    body: formData,
  });
  const uploadBody = await uploadRes.json().catch(() => null);

  if (!uploadRes.ok || !uploadBody?.secure_url) {
    throw new Error(uploadBody?.error?.message ?? "Upload failed. Please try again.");
  }

  return {
    url: uploadBody.secure_url as string,
    width: typeof uploadBody.width === "number" ? uploadBody.width : undefined,
    height: typeof uploadBody.height === "number" ? uploadBody.height : undefined,
    durationSeconds: typeof uploadBody.duration === "number" ? uploadBody.duration : undefined,
  };
}

/** Simple uploads whose fallback route returns `{ url }` at the top level (verification docs). */
export async function uploadDirectToCloudinary(
  file: File,
  purpose: string,
  fallbackUrl: string
): Promise<{ url: string }> {
  const sign = await requestSignature(purpose);
  if (!sign) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(fallbackUrl, { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? "Upload failed. Please try again.");
    return { url: body.url as string };
  }

  return postDirectToCloudinary(file, sign);
}

/** Richer uploads (post/message media) whose fallback route returns `{ media: {...} }`,
 * carrying width/height/duration alongside the url. */
export async function uploadMediaDirectToCloudinary(
  file: File,
  purpose: string,
  fallbackUrl: string
): Promise<CloudinaryUploadResult> {
  const sign = await requestSignature(purpose);
  if (!sign) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(fallbackUrl, { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? "Upload failed. Please try again.");
    return body.media as CloudinaryUploadResult;
  }

  return postDirectToCloudinary(file, sign);
}
