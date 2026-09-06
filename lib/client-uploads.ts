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

import {
  getBunnyUploadTransportOrder,
  inferVideoContentType,
  MAX_VIDEO_DURATION_SECONDS,
  type BunnyUploadTransport,
} from "@/lib/video-upload-constraints";

const FIRST_PARTY_UPLOAD_MAX_BYTES = 3.5 * 1024 * 1024;
const BUNNY_MOBILE_TUS_ENDPOINT = "/api/upload/bunny-tus";

/** Longest a single reconnect wait sits before retrying anyway - the `online` event is the
 * fast path, this is the backstop so a browser that misreports offline (or never fires the
 * matching online transition) can't hang an upload indefinitely. */
const RECONNECT_WAIT_TIMEOUT_MS = 15_000;

type SignedUpload = {
  apiKey: string;
  cloudName: string;
  folder: string;
  timestamp: number;
  signature: string;
  transformation?: string;
  format?: string;
  resourceType: "image" | "video";
};

type CloudinaryUploadResult = {
  url: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

async function requestSignature(purpose: string): Promise<SignedUpload | null> {
  return withUploadRetries(async () => {
    const signRes = await fetch("/api/upload/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose }),
    });

    // 503 is the documented "Cloudinary isn't configured here" contract, not a failure.
    if (signRes.status === 503) return null;

    if (!signRes.ok) {
      const body = await signRes.json().catch(() => null);
      throw new TerminalUploadError(body?.error ?? "Upload failed. Please try again.");
    }

    return signRes.json();
  });
}

/** A refusal the server actually answered with (bad signature, oversized file, unsupported
 * format). Retrying one of these can only fail the same way, so withUploadRetries stops. */
class TerminalUploadError extends Error {}

class ProviderReachabilityError extends Error {}

function browserIsOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function isLikelyMobileBrowser() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia?.("(pointer: coarse)").matches === true
  );
}

function shouldUseFirstPartyImageUpload(file: File) {
  return isLikelyMobileBrowser() && file.size <= FIRST_PARTY_UPLOAD_MAX_BYTES;
}

async function uploadThroughApplication(
  file: File,
  fallbackUrl: string,
  onProgress?: (fraction: number) => void,
) {
  onProgress?.(0.06);
  const body = await withUploadRetries(async () => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(fallbackUrl, { method: "POST", body: formData });
    const parsed = await res.json().catch(() => null);
    if (!res.ok) {
      throw new TerminalUploadError(parsed?.error ?? "Upload failed. Please try again.");
    }
    return parsed;
  });
  onProgress?.(1);
  return body;
}

/** Attempts an upload up to `RETRY_DELAYS.length + 1` times, backing off between tries and
 * waiting out a reported offline stretch first (retrying into a dead connection just burns
 * an attempt). A single dropped request on mobile data is the most common upload failure
 * there is, and it used to end the whole upload here on the first try. */
async function withUploadRetries<T>(attempt: () => Promise<T>): Promise<T> {
  const RETRY_DELAYS = [1000, 3000, 6000];
  let lastError: unknown;

  for (let index = 0; index <= RETRY_DELAYS.length; index += 1) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      if (error instanceof TerminalUploadError) break;
      const delay = RETRY_DELAYS[index];
      if (delay === undefined) break;
      await waitForConnection();
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Upload failed. Please try again.");
}

/** Resolves as soon as the browser reports a connection again, or after a bounded wait -
 * some mobile browsers report offline without ever firing the matching `online` event, so
 * this can never be the thing that hangs an upload. */
function waitForConnection(): Promise<void> {
  if (navigator.onLine !== false) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("online", done);
      clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = setTimeout(done, RECONNECT_WAIT_TIMEOUT_MS);
    window.addEventListener("online", done, { once: true });
  });
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
    if (sign.format) formData.append("format", sign.format);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`);
    xhr.timeout = 15 * 60 * 1000;

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
        return;
      }

      // Cloudinary answered and refused (bad signature, oversized file, unsupported
      // format) - retrying that only burns time, so it's marked terminal.
      const providerMessage = body?.error?.message?.trim();
      reject(
        new TerminalUploadError(
          providerMessage
            ? `This media could not be processed: ${providerMessage}`
            : "This media could not be uploaded. Please choose another file.",
        ),
      );
    };
    // No response at all: a dropped request, worth retrying.
    xhr.onerror = () =>
      reject(
        new ProviderReachabilityError(
          browserIsOffline()
            ? "Upload paused because this device is offline. Reconnect and try again."
            : "Cloudinary could not be reached. The upload will retry automatically.",
        ),
      );
    xhr.ontimeout = () =>
      reject(new ProviderReachabilityError("The image upload timed out. Try again without leaving this screen."));
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
  if (!sign || shouldUseFirstPartyImageUpload(file)) {
    const body = await uploadThroughApplication(file, fallbackUrl, onProgress);
    return { url: body.url as string };
  }

  try {
    return await withUploadRetries(() => postDirectToCloudinary(file, sign, onProgress));
  } catch (error) {
    if (error instanceof ProviderReachabilityError && file.size <= FIRST_PARTY_UPLOAD_MAX_BYTES) {
      const body = await uploadThroughApplication(file, fallbackUrl, onProgress);
      return { url: body.url as string };
    }
    throw error;
  }
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
  if (!sign || shouldUseFirstPartyImageUpload(file)) {
    const body = await uploadThroughApplication(file, fallbackUrl, onProgress);
    return body.media as CloudinaryUploadResult;
  }

  try {
    return await withUploadRetries(() => postDirectToCloudinary(file, sign, onProgress));
  } catch (error) {
    if (error instanceof ProviderReachabilityError && file.size <= FIRST_PARTY_UPLOAD_MAX_BYTES) {
      const body = await uploadThroughApplication(file, fallbackUrl, onProgress);
      return body.media as CloudinaryUploadResult;
    }
    throw error;
  }
}

type BunnyUploadAuth = {
  tusEndpoint: string;
  libraryId: string;
  videoId: string;
  authorizationSignature: string;
  authorizationExpire: number;
  contentType?: string;
};

/** How many times a dropped connection gets to reconnect and resume before giving up for
 * good - bounds a pathological flap (on/offline/on/offline...). */
const MAX_RECONNECT_RESUMES = 3;

/**
 * tus-js-client defaults to `Infinity` - i.e. the ENTIRE file in a single PATCH. That
 * default is what made video
 * uploads fail here: a phone video (allowed up to 300MB) went up as one enormous request,
 * so any blip on mobile data killed the whole thing, and because the server never
 * acknowledged an intermediate offset there was nothing to resume from - every retry
 * restarted at byte 0, which is exactly what "failed to upload chunk at offset 0" meant.
 * Chunking makes each request small enough to survive a weak signal, and makes the
 * server-acknowledged offset real, so a retry picks up where it stopped.
 */
const BUNNY_CHUNK_SIZE = 5 * 1024 * 1024;
const BUNNY_MOBILE_CHUNK_SIZE = 3 * 1024 * 1024;

function discardFailedBunnyVideo(auth: BunnyUploadAuth) {
  void fetch("/api/upload/bunny-abort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoId: auth.videoId,
      libraryId: auth.libraryId,
      authorizationExpire: auth.authorizationExpire,
      authorizationSignature: auth.authorizationSignature,
    }),
    keepalive: true,
  }).catch(() => undefined);
}

type TusResponseLike = {
  getStatus?: () => number;
  getBody?: () => string;
};

function describeTusFailure(error: unknown): {
  retryable: boolean;
  message: string;
  status?: number;
} {
  const response = (error as { originalResponse?: TusResponseLike } | null)?.originalResponse;
  let status: number | undefined;
  let body = "";

  try {
    status = response?.getStatus?.();
    body = response?.getBody?.() ?? "";
  } catch {
    // Some adapters expose a response object without readable methods.
  }

  if (!status || status === 0) {
    return {
      retryable: true,
      status,
      message: browserIsOffline()
        ? "The upload is waiting for your connection to return."
        : "The video service could not be reached. The upload will resume automatically.",
    };
  }

  if (status === 408 || status === 409 || status === 423 || status === 425 || status === 429 || status >= 500) {
    return {
      retryable: true,
      status,
      message:
        status === 429
          ? "The video service is busy. The upload will resume automatically."
          : "The video service was interrupted. The upload will resume automatically.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      retryable: false,
      status,
      message: "Video upload authorization was rejected. Please refresh the page and try again.",
    };
  }

  if (status === 413) {
    return {
      retryable: false,
      status,
      message: "This video is larger than the connected video library allows.",
    };
  }

  if (status === 400 || status === 415 || /unsupported|invalid (?:file|video|format)/i.test(body)) {
    return {
      retryable: false,
      status,
      message: "This video could not be decoded. Try a different export; MP4 works best.",
    };
  }

  return {
    retryable: false,
    status,
    message: `The video service rejected this upload${status ? ` (${status})` : ""}. Please try another file.`,
  };
}

class BunnyTusTransportError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly bytesUploaded: number,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BunnyTusTransportError";
  }
}

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
  transport: BunnyUploadTransport,
  canSwitchTransport: boolean,
  onProgress?: (fraction: number) => void,
  onPhaseChange?: (phase: VideoUploadPhase) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let reconnectResumes = 0;
    let bytesUploaded = 0;
    let settled = false;
    const useFirstPartyTransport = transport === "relay";
    const contentType =
      auth.contentType ?? inferVideoContentType(file.name, file.type) ?? "video/mp4";

    const upload = new tus.Upload(file, {
      endpoint: useFirstPartyTransport ? BUNNY_MOBILE_TUS_ENDPOINT : auth.tusEndpoint,
      chunkSize: useFirstPartyTransport ? BUNNY_MOBILE_CHUNK_SIZE : BUNNY_CHUNK_SIZE,
      // Each authorization belongs to a newly-created Bunny video. Persisting its upload
      // URL in Chrome's storage cannot safely resume a later attempt with a new video ID.
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      // A modest bump over tus-js-client's own default ([0, 1000, 3000, 5000], ~9s total) -
      // covers more of the "still connected but flaky" case automatically without leaving
      // anyone waiting minutes for something that isn't a real outage. With chunking above,
      // each of these retries only re-sends the failed 5MB chunk, not the whole file.
      retryDelays:
        transport === "direct" && canSwitchTransport
          ? [0, 1000, 2500]
          : [0, 1000, 2000, 4000, 8000, 8000],
      headers: {
        AuthorizationSignature: auth.authorizationSignature,
        AuthorizationExpire: String(auth.authorizationExpire),
        VideoId: auth.videoId,
        LibraryId: auth.libraryId,
      },
      metadata: { filename: file.name, filetype: contentType, title: file.name },
      onError: (error) => {
        if (settled) return;
        console.error("[uploads] Bunny TUS upload failed", error);
        const failure = describeTusFailure(error);

        // If the provider has not accepted a single byte, a different network route is
        // safer than repeatedly restarting the same failed browser handshake.
        if (failure.retryable && bytesUploaded === 0 && canSwitchTransport) {
          settled = true;
          reject(
            new BunnyTusTransportError(
              failure.message,
              failure.retryable,
              bytesUploaded,
              failure.status,
            ),
          );
          return;
        }

        if (failure.retryable && reconnectResumes < MAX_RECONNECT_RESUMES) {
          reconnectResumes += 1;
          onPhaseChange?.(browserIsOffline() ? "reconnecting" : "retrying");
          // Resumes from the last chunk the server acknowledged (see BUNNY_CHUNK_SIZE) -
          // only the interrupted chunk is re-sent, never the whole file.
          void waitForConnection().then(() => {
            onPhaseChange?.("uploading");
            upload.start();
          });
          return;
        }

        // tus-js-client's own error carries a raw HTTP request/response dump ("originated
        // from request (method: PATCH, url: ..., response code: n/a...)") - useful for
        // debugging, meaningless and alarming as user-facing text. Surface a plain retry
        // message instead - reached only once reconnect resumes are exhausted, or the
        // failure wasn't about connectivity at all.
        settled = true;
        reject(
          new BunnyTusTransportError(
            failure.message,
            failure.retryable,
            bytesUploaded,
            failure.status,
          ),
        );
      },
      onProgress: (uploadedBytes, bytesTotal) => {
        if (settled) return;
        bytesUploaded = Math.max(bytesUploaded, uploadedBytes);
        if (bytesTotal > 0) onProgress?.(uploadedBytes / bytesTotal);
      },
      onSuccess: () => {
        if (settled) return;
        settled = true;
        resolve();
      },
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
 * outcome to fall back to here. Bounded generously for the app's 15-minute video cap.
 * `onProgress`
 * gets Bunny's own 0-100 encodeProgress (as a 0-1 fraction, matching the upload phase's
 * convention) each time it moves, so a caller can show a real transcode meter. */
async function pollBunnyVideoStatus(
  videoId: string,
  onProgress?: (fraction: number) => void
): Promise<BunnyReadyStatus> {
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    // The file is already safely on Bunny by this point - a dropped poll must never be
    // what loses it, so a failed request just waits and asks again rather than throwing.
    try {
      const res = await fetch(`/api/upload/bunny-status/${videoId}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state === "failed") {
          throw new TerminalUploadError(
            data.error ?? "Bunny could not process this video. Try another export or file.",
          );
        }
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
    } catch (error) {
      if (error instanceof TerminalUploadError) throw error;
      console.error("[uploads] Bunny status poll failed, retrying", error);
    }
    await waitForConnection();
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Your video is still processing. Please try publishing again in a minute.");
}

export type VideoUploadPhase =
  | "preparing"
  | "uploading"
  | "processing"
  | "reconnecting"
  | "retrying";

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
  onPhaseChange?.("preparing");
  onProgress?.(0.02);
  const auth = await withUploadRetries(async () => {
    const signRes = await fetch("/api/upload/bunny-sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: "post-video",
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
      }),
    });

    // 503 is the documented "Bunny isn't configured here" contract, not a failure.
    if (signRes.status === 503) return null;
    if (!signRes.ok) {
      const body = await signRes.json().catch(() => null);
      throw new TerminalUploadError(body?.error ?? "Upload failed. Please try again.");
    }
    return (await signRes.json()) as BunnyUploadAuth;
  });

  if (!auth) {
    onPhaseChange?.("uploading");
    return uploadMediaDirectToCloudinary(
      file,
      "post-video",
      fallbackUrl,
      (fraction) => onProgress?.(0.04 + fraction * 0.96),
    );
  }

  onPhaseChange?.("uploading");
  try {
    const transports = getBunnyUploadTransportOrder(
      navigator.userAgent,
      isLikelyMobileBrowser(),
    );
    let uploaded = false;
    let lastTransportError: unknown;

    for (let index = 0; index < transports.length; index += 1) {
      const transport = transports[index];
      try {
        await uploadToBunnyViaTus(
          file,
          auth,
          transport,
          index < transports.length - 1,
          (fraction) => onProgress?.(0.04 + fraction * 0.76),
          onPhaseChange,
        );
        uploaded = true;
        break;
      } catch (error) {
        lastTransportError = error;
        const canTryAlternate =
          error instanceof BunnyTusTransportError &&
          error.retryable &&
          error.bytesUploaded === 0 &&
          index < transports.length - 1;
        if (!canTryAlternate) throw error;
        onPhaseChange?.("retrying");
      }
    }

    if (!uploaded) throw lastTransportError ?? new Error("Video upload failed.");
  } catch (error) {
    discardFailedBunnyVideo(auth);
    throw error;
  }

  onPhaseChange?.("processing");
  onProgress?.(0.8);
  const status = await pollBunnyVideoStatus(auth.videoId, (fraction) =>
    onProgress?.(0.8 + fraction * 0.2),
  );

  if (
    typeof status.durationSeconds === "number" &&
    status.durationSeconds > MAX_VIDEO_DURATION_SECONDS
  ) {
    discardFailedBunnyVideo(auth);
    throw new TerminalUploadError("Videos must be 15 minutes or shorter.");
  }

  return {
    url: status.url,
    width: status.width ?? undefined,
    height: status.height ?? undefined,
    durationSeconds: status.durationSeconds ?? undefined,
  };
}
