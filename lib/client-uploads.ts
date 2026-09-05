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

/** Uses XHR (not fetch) because only XHR exposes upload-progress events - needed so
 * callers can show a real percentage instead of an indeterminate spinner. */
function postDirectToCloudinary(
  file: File,
  sign: SignedUpload,
  onProgress?: (fraction: number) => void
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", sign.apiKey);
    formData.append("timestamp", String(sign.timestamp));
    formData.append("signature", sign.signature);
    formData.append("folder", sign.folder);
    if (sign.transformation) formData.append("transformation", sign.transformation);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
    }

    xhr.onload = () => {
      let body: { secure_url?: string; width?: number; height?: number; duration?: number; error?: { message?: string } } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && body?.secure_url) {
        resolve({
          url: body.secure_url,
          width: typeof body.width === "number" ? body.width : undefined,
          height: typeof body.height === "number" ? body.height : undefined,
          durationSeconds: typeof body.duration === "number" ? body.duration : undefined,
        });
      } else {
        reject(new Error(body?.error?.message ?? "Upload failed. Please try again."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Please try again."));
    xhr.send(formData);
  });
}

/** Simple uploads whose fallback route returns `{ url }` at the top level (verification docs). */
export async function uploadDirectToCloudinary(
  file: File,
  purpose: string,
  fallbackUrl: string,
  onProgress?: (fraction: number) => void
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

  return postDirectToCloudinary(file, sign, onProgress);
}

/** Richer uploads (post/message media) whose fallback route returns `{ media: {...} }`,
 * carrying width/height/duration alongside the url. */
export async function uploadMediaDirectToCloudinary(
  file: File,
  purpose: string,
  fallbackUrl: string,
  onProgress?: (fraction: number) => void
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

  return postDirectToCloudinary(file, sign, onProgress);
}

/** Reads a video's natural dimensions and duration without ever attaching it to the DOM -
 * only needed for the R2 path below, since R2 (unlike Cloudinary) never inspects the file
 * and returns none of this metadata back. Resolves zeros rather than rejecting if it can't
 * be read within the timeout, the same fallback shape post-composer.tsx's own
 * readVideoDurationSeconds uses. */
function readVideoMetadata(file: File): Promise<{ width: number; height: number; durationSeconds: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (value: { width: number; height: number; durationSeconds: number }) => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish({ width: 0, height: 0, durationSeconds: 0 }), 8000);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      finish({ width: video.videoWidth, height: video.videoHeight, durationSeconds: video.duration || 0 });
    };
    video.onerror = () => {
      window.clearTimeout(timeout);
      finish({ width: 0, height: 0, durationSeconds: 0 });
    };
    video.src = url;
  });
}

/** Uses XHR (not fetch) for the same upload-progress reason as postDirectToCloudinary. */
function putDirectToR2(file: File, uploadUrl: string, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Please try again."));
    xhr.send(file);
  });
}

/**
 * Uploads a feed-post video straight to Cloudflare R2 via a presigned PUT URL when R2 is
 * configured, falling back to the existing Cloudinary/local-disk path (same fallbackUrl
 * contract as uploadMediaDirectToCloudinary) when it isn't - mirrors requestSignature's
 * own 503-means-not-configured handling. Images never call this; only feed-post video
 * moved to R2 (see lib/r2.ts's doc comment for why).
 */
export async function uploadVideoDirect(
  file: File,
  fallbackUrl: string,
  onProgress?: (fraction: number) => void
): Promise<CloudinaryUploadResult> {
  const signRes = await fetch("/api/upload/r2-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose: "post-video", contentType: file.type }),
  });

  if (signRes.status === 503) {
    return uploadMediaDirectToCloudinary(file, "post-video", fallbackUrl, onProgress);
  }
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => null);
    throw new Error(body?.error ?? "Upload failed. Please try again.");
  }

  const { uploadUrl, publicUrl } = (await signRes.json()) as { uploadUrl: string; publicUrl: string };
  const metadata = await readVideoMetadata(file);
  await putDirectToR2(file, uploadUrl, onProgress);

  return {
    url: publicUrl,
    width: metadata.width || undefined,
    height: metadata.height || undefined,
    durationSeconds: metadata.durationSeconds || undefined,
  };
}
