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

import * as tus from "tus-js-client";

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

type BunnyUploadAuth = {
  tusEndpoint: string;
  libraryId: string;
  videoId: string;
  authorizationSignature: string;
  authorizationExpire: number;
};

/** How many times a dropped connection gets to reconnect and resume before giving up for
 * good - bounds a pathological flap (on/offline/on/offline...). */
const MAX_RECONNECT_RESUMES = 3;

/** Longest a single reconnect wait sits before retrying anyway - the `online` event is the
 * fast path, this is the backstop so a browser that misreports offline (or never fires the
 * matching online transition) can't hang the upload indefinitely. */
const RECONNECT_WAIT_TIMEOUT_MS = 15_000;

/** Uploads the raw file to Bunny Stream over TUS (resumable, chunked upload) using the
 * one-time signature our server issued - Bunny's basic upload endpoint requires the secret
 * API key itself, so a plain XHR PUT (like R2's) isn't an option here.
 *
 * Resilience is layered: tus-js-client's own `retryDelays` retries a flaky-but-still-
 * connected request automatically (a weak signal, one dropped packet) within seconds - but
 * by design it won't spend that budget while the browser reports fully offline, so it fails
 * fast (`onError`) the moment a real connection drop happens rather than sitting through it.
 * The `online` listener below is what actually rides that out: it waits for the browser to
 * report reconnection, then resumes the SAME upload instance from its last acknowledged
 * byte (tus tracks this internally; nothing gets re-sent), so a subway tunnel or elevator
 * ride self-heals without the person ever reselecting the file. */
function uploadToBunnyViaTus(
  file: File,
  auth: BunnyUploadAuth,
  onProgress?: (fraction: number) => void,
  onPhaseChange?: (phase: VideoUploadPhase) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let reconnectResumes = 0;

    const upload = new tus.Upload(file, {
      endpoint: auth.tusEndpoint,
      // A modest bump over tus-js-client's own default ([0, 1000, 3000, 5000], ~9s total) -
      // covers more of the "still connected but flaky" case automatically without leaving
      // anyone waiting minutes for something that isn't a real outage.
      retryDelays: [0, 1000, 2000, 4000, 8000, 8000],
      headers: {
        AuthorizationSignature: auth.authorizationSignature,
        AuthorizationExpire: String(auth.authorizationExpire),
        VideoId: auth.videoId,
        LibraryId: auth.libraryId,
      },
      metadata: { filetype: file.type, title: file.name },
      onError: (error) => {
        console.error("[uploads] Bunny TUS upload failed", error);

        if (navigator.onLine === false && reconnectResumes < MAX_RECONNECT_RESUMES) {
          reconnectResumes += 1;
          onPhaseChange?.("reconnecting");

          // Some mobile browsers/WebViews report navigator.onLine === false without
          // reliably firing a matching `online` event later (or it was already false
          // before the upload even started) - without a bound, that leaves the upload
          // waiting forever on an event that may never come. Retry regardless once this
          // fires, from whichever of the two happens first.
          let settled = false;
          const resume = () => {
            if (settled) return;
            settled = true;
            window.removeEventListener("online", resume);
            clearTimeout(timeoutId);
            onPhaseChange?.("uploading");
            upload.start();
          };
          const timeoutId = setTimeout(resume, RECONNECT_WAIT_TIMEOUT_MS);
          window.addEventListener("online", resume, { once: true });
          return;
        }

        // tus-js-client's own error carries a raw HTTP request/response dump ("originated
        // from request (method: PATCH, url: ..., response code: n/a...)") - useful for
        // debugging, meaningless and alarming as user-facing text. Surface a plain retry
        // message instead - reached only once reconnect resumes are exhausted, or the
        // failure wasn't about connectivity at all.
        reject(new Error("Your video couldn't upload - check your connection and try again."));
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (bytesTotal > 0) onProgress?.(bytesUploaded / bytesTotal);
      },
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

type BunnyReadyStatus = {
  url: string;
  thumbnailUrl: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

/** Polls our status route until Bunny finishes transcoding, since playback needs the
 * rendition manifest that only exists once processing completes - there's no upload-only
 * outcome to fall back to here. Bounded generously (this app caps videos at 3 minutes /
 * 300MB, well within what Bunny's free H.264 encoding tier finishes quickly). `onProgress`
 * gets Bunny's own 0-100 encodeProgress (as a 0-1 fraction, matching the upload phase's
 * convention) each time it moves, so a caller can show a real transcode meter. */
async function pollBunnyVideoStatus(
  videoId: string,
  onProgress?: (fraction: number) => void
): Promise<BunnyReadyStatus> {
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    const res = await fetch(`/api/upload/bunny-status/${videoId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.ready) {
        return {
          url: data.url,
          thumbnailUrl: data.thumbnailUrl,
          width: data.width,
          height: data.height,
          durationSeconds: data.durationSeconds,
        };
      }
      if (typeof data.encodeProgress === "number") onProgress?.(data.encodeProgress / 100);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Your video is still processing. Please try publishing again in a minute.");
}

export type VideoUploadPhase = "uploading" | "processing" | "reconnecting";

/**
 * Uploads a feed-post video to Bunny Stream when it's configured, falling back to the
 * existing Cloudinary/local-disk path (same fallbackUrl contract as
 * uploadMediaDirectToCloudinary) when it isn't - mirrors requestSignature's own
 * 503-means-not-configured handling. Images never call this; only feed-post video goes
 * through Bunny (see lib/bunny-stream.ts's doc comment for why). `onPhaseChange` lets the
 * composer distinguish "uploading the file" from "waiting on transcoding" in its UI.
 */
export async function uploadVideoDirect(
  file: File,
  fallbackUrl: string,
  onProgress?: (fraction: number) => void,
  onPhaseChange?: (phase: VideoUploadPhase) => void
): Promise<CloudinaryUploadResult> {
  const signRes = await fetch("/api/upload/bunny-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose: "post-video" }),
  });

  if (signRes.status === 503) {
    return uploadMediaDirectToCloudinary(file, "post-video", fallbackUrl, onProgress);
  }
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => null);
    throw new Error(body?.error ?? "Upload failed. Please try again.");
  }

  const auth = (await signRes.json()) as BunnyUploadAuth;

  onPhaseChange?.("uploading");
  await uploadToBunnyViaTus(file, auth, onProgress, onPhaseChange);

  onPhaseChange?.("processing");
  const status = await pollBunnyVideoStatus(auth.videoId, onProgress);

  return {
    url: status.url,
    width: status.width ?? undefined,
    height: status.height ?? undefined,
    durationSeconds: status.durationSeconds ?? undefined,
  };
}
