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
  bunnyChunkStallTimeoutMs,
  bunnyDirectChunkSizeBytes,
  getBunnyUploadTransportOrder,
  inferVideoContentType,
  type BunnyUploadTransport,
} from "@/lib/video-upload-constraints";

const FIRST_PARTY_UPLOAD_MAX_BYTES = 3.5 * 1024 * 1024;
const BUNNY_MOBILE_TUS_ENDPOINT = "/api/upload/bunny-tus";
const UPLOAD_CONTROL_REQUEST_TIMEOUT_MS = 20_000;
const BUNNY_MAX_NO_PROGRESS_RETRY_MS = 15 * 60 * 1000;
const BUNNY_COMPLETION_ACK_TIMEOUT_MS = 15_000;
const BUNNY_CONFIRMATION_DELAYS_MS = [0, 1_500, 3_500] as const;
const BUNNY_AUTH_CACHE_PREFIX = "udala:bunny-upload:v2:";

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
  /** Draft-only cleanup. It is deliberately omitted from the post payload. */
  discard?: () => void;
};

async function requestSignature(purpose: string): Promise<SignedUpload | null> {
  return withUploadRetries(async () => {
    const signRes = await fetchWithTimeout("/api/upload/sign", {
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

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = UPLOAD_CONTROL_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

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
  /** Derived from the video id server-side, so it is valid the moment the video object
   * exists - long before Bunny has encoded anything into it. */
  playbackUrl: string;
};

type VideoProgress = {
  uploadedBytes: number;
  totalBytes: number;
};

function bunnyAuthCacheKey(file: File) {
  return `${BUNNY_AUTH_CACHE_PREFIX}${encodeURIComponent(
    [file.name, file.size, file.lastModified, file.type].join(":"),
  )}`;
}

function readCachedBunnyAuth(file: File): BunnyUploadAuth | null {
  try {
    const key = bunnyAuthCacheKey(file);
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as Partial<BunnyUploadAuth> | null;
    const isUsable =
      parsed &&
      typeof parsed.tusEndpoint === "string" &&
      typeof parsed.libraryId === "string" &&
      typeof parsed.videoId === "string" &&
      typeof parsed.authorizationSignature === "string" &&
      typeof parsed.authorizationExpire === "number" &&
      typeof parsed.playbackUrl === "string" &&
      parsed.authorizationExpire > Math.floor(Date.now() / 1000) + 5 * 60;

    if (isUsable) return parsed as BunnyUploadAuth;
    window.localStorage.removeItem(key);
  } catch {
    // Storage may be blocked in private mode. The upload still works for this tab.
  }
  return null;
}

function cacheBunnyAuth(file: File, auth: BunnyUploadAuth) {
  try {
    window.localStorage.setItem(bunnyAuthCacheKey(file), JSON.stringify(auth));
  } catch {
    // A resumable upload must not depend on localStorage being available.
  }
}

function clearCachedBunnyAuth(file: File) {
  try {
    window.localStorage.removeItem(bunnyAuthCacheKey(file));
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

type BunnyConfirmation = "accepted" | "failed" | "incomplete" | "unavailable";

async function confirmBunnyUpload(auth: BunnyUploadAuth): Promise<BunnyConfirmation> {
  let lastResult: BunnyConfirmation = "unavailable";

  for (const delay of BUNNY_CONFIRMATION_DELAYS_MS) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const res = await fetchWithTimeout(
        "/api/upload/bunny-status",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: auth.videoId,
            libraryId: auth.libraryId,
            authorizationExpire: auth.authorizationExpire,
            authorizationSignature: auth.authorizationSignature,
          }),
        },
        10_000,
      );
      if (!res.ok) continue;
      const body = (await res.json().catch(() => null)) as { result?: BunnyConfirmation } | null;
      if (body?.result === "accepted" || body?.result === "failed") return body.result;
      if (body?.result === "incomplete") lastResult = "incomplete";
    } catch {
      // A failed confirmation request is not proof that the upload failed. Keep the
      // resumable upload metadata and let the ordinary retry path continue from its offset.
    }
  }

  return lastResult;
}

/**
 * tus-js-client defaults to `Infinity` - i.e. the ENTIRE file in a single PATCH. That
 * default is what made video
 * uploads fail here: a phone video went up as one enormous request,
 * so any blip on mobile data killed the whole thing, and because the server never
 * acknowledged an intermediate offset there was nothing to resume from - every retry
 * restarted at byte 0, which is exactly what "failed to upload chunk at offset 0" meant.
 * Chunking makes each request small enough to survive a weak signal, and makes the
 * server-acknowledged offset real, so a retry picks up where it stopped.
 *
 * The direct-to-Bunny chunk now scales with the file (see bunnyDirectChunkSizeBytes) so a
 * multi-gigabyte upload is a few hundred requests rather than several thousand. The relay
 * chunk cannot: it passes through our own serverless route, and the platform rejects a
 * request body much over 4.5MB before the handler ever runs.
 */
const BUNNY_MOBILE_CHUNK_SIZE = 3 * 1024 * 1024;

function bunnyTusFingerprint(
  file: File,
  auth: BunnyUploadAuth,
  transport: BunnyUploadTransport,
) {
  return [
    "udala-bunny-v2",
    auth.libraryId,
    auth.videoId,
    transport,
    file.name,
    file.size,
    file.lastModified,
  ].join("-");
}

async function forgetStoredBunnyUploads(file: File, auth: BunnyUploadAuth) {
  await Promise.all(
    (["direct", "relay"] as const).map(async (transport) => {
      const previous = await tus.defaultOptions.urlStorage.findUploadsByFingerprint(
        bunnyTusFingerprint(file, auth, transport),
      );
      await Promise.all(
        previous.map((upload) =>
          tus.defaultOptions.urlStorage.removeUpload(upload.urlStorageKey),
        ),
      );
    }),
  ).catch(() => undefined);
}

async function requestDiscardBunnyVideo(auth: BunnyUploadAuth) {
  await fetch("/api/upload/bunny-abort", {
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

function discardBunnyUpload(file: File, auth: BunnyUploadAuth) {
  clearCachedBunnyAuth(file);
  void Promise.allSettled([
    forgetStoredBunnyUploads(file, auth),
    requestDiscardBunnyVideo(auth),
  ]);
}

/** Called when the creator removes a resumable failure from the draft. Retrying preserves
 * Bunny's object and offset; explicitly removing it does the opposite and cleans both the
 * provider object and the local resume pointers. */
export async function discardVideoUpload(file: File): Promise<void> {
  const auth = readCachedBunnyAuth(file);
  if (!auth) return;
  clearCachedBunnyAuth(file);
  await Promise.allSettled([
    forgetStoredBunnyUploads(file, auth),
    requestDiscardBunnyVideo(auth),
  ]);
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
  onProgress?: (fraction: number, detail?: VideoProgress) => void,
  onPhaseChange?: (phase: VideoUploadPhase) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let bytesUploaded = 0;
    let lastProgressAt = Date.now();
    let settled = false;
    let hasStoredUpload = false;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let completionTimer: ReturnType<typeof setTimeout> | null = null;
    const useFirstPartyTransport = transport === "relay";
    const chunkSize = useFirstPartyTransport
      ? BUNNY_MOBILE_CHUNK_SIZE
      : bunnyDirectChunkSizeBytes(file.size, isLikelyMobileBrowser());
    const stallTimeoutMs = bunnyChunkStallTimeoutMs(chunkSize);
    const contentType =
      auth.contentType ?? inferVideoContentType(file.name, file.type) ?? "video/mp4";

    const clearRecoveryTimers = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      if (stallTimer) clearTimeout(stallTimer);
      if (completionTimer) clearTimeout(completionTimer);
      resumeTimer = null;
      stallTimer = null;
      completionTimer = null;
    };

    const canKeepRecovering = () =>
      Date.now() - lastProgressAt < BUNNY_MAX_NO_PROGRESS_RETRY_MS &&
      auth.authorizationExpire > Math.floor(Date.now() / 1000) + 60;

    const failAfterRecoveryWindow = (message: string, status?: number) => {
      if (settled) return;
      settled = true;
      clearRecoveryTimers();
      void upload.abort(false);
      reject(
        new BunnyTusTransportError(
          message,
          true,
          Math.max(bytesUploaded, hasStoredUpload ? 1 : 0),
          status,
        ),
      );
    };

    const resumeAfterInterruption = (phase: VideoUploadPhase) => {
      if (settled || resumeTimer) return;
      if (!canKeepRecovering()) {
        failAfterRecoveryWindow(
          "We couldn't reconnect to the video service. Your uploaded progress is saved — tap Try upload again to continue.",
        );
        return;
      }

      onPhaseChange?.(phase);
      const noProgressMs = Date.now() - lastProgressAt;
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(5, Math.floor(noProgressMs / 30_000)));
      void waitForConnection().then(() => {
        if (settled) return;
        resumeTimer = setTimeout(() => {
          resumeTimer = null;
          if (settled) return;
          onPhaseChange?.("uploading");
          upload.start();
        }, delay);
      });
    };

    const armStallWatchdog = () => {
      if (stallTimer) clearTimeout(stallTimer);
      if (settled) return;
      stallTimer = setTimeout(() => {
        stallTimer = null;
        if (settled) return;
        if (!canKeepRecovering()) {
          failAfterRecoveryWindow(
            "The video upload stopped responding. Your uploaded progress is saved — tap Try upload again to continue.",
          );
          return;
        }
        const recoveryPhase = browserIsOffline() ? "reconnecting" : "retrying";
        onPhaseChange?.(recoveryPhase);
        void upload.abort(false).then(() => resumeAfterInterruption(recoveryPhase));
      }, stallTimeoutMs);
    };

    const upload = new tus.Upload(file, {
      endpoint: useFirstPartyTransport ? BUNNY_MOBILE_TUS_ENDPOINT : auth.tusEndpoint,
      chunkSize,
      // The fingerprint includes Bunny's video id, so a later selection of this exact file
      // can safely recover the same upload URL without mixing two video objects.
      fingerprint: async () => bunnyTusFingerprint(file, auth, transport),
      storeFingerprintForResuming: true,
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
      onBeforeRequest: () => {
        armStallWatchdog();
      },
      onAfterResponse: () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = null;
      },
      onError: (error) => {
        if (settled) return;
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = null;
        console.error("[uploads] Bunny TUS upload failed", error);
        const failure = describeTusFailure(error);

        // If the provider has not accepted a single byte, a different network route is
        // safer than repeatedly restarting the same failed browser handshake.
        if (
          failure.retryable &&
          bytesUploaded === 0 &&
          !hasStoredUpload &&
          canSwitchTransport
        ) {
          settled = true;
          clearRecoveryTimers();
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

        if (failure.retryable && canKeepRecovering()) {
          // Resumes from the last chunk the server acknowledged. A time-based recovery
          // window keeps long premium uploads alive through repeated connection changes
          // without leaving a genuinely dead upload spinning forever.
          resumeAfterInterruption(browserIsOffline() ? "reconnecting" : "retrying");
          return;
        }

        if (failure.retryable) {
          failAfterRecoveryWindow(
            "We couldn't reconnect to the video service. Your uploaded progress is saved — tap Try upload again to continue.",
            failure.status,
          );
          return;
        }

        // tus-js-client's own error carries a raw HTTP request/response dump ("originated
        // from request (method: PATCH, url: ..., response code: n/a...)") - useful for
        // debugging, meaningless and alarming as user-facing text. Surface a plain retry
        // message instead - reached only when the failure was not about connectivity.
        settled = true;
        clearRecoveryTimers();
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
        if (uploadedBytes > bytesUploaded) lastProgressAt = Date.now();
        bytesUploaded = Math.max(bytesUploaded, uploadedBytes);
        if (bytesTotal > 0 && uploadedBytes >= bytesTotal) {
          onPhaseChange?.("confirming");
          if (!completionTimer) {
            completionTimer = setTimeout(() => {
              completionTimer = null;
              if (settled) return;
              settled = true;
              clearRecoveryTimers();
              void upload.abort(false);
              reject(
                new BunnyTusTransportError(
                  "The video was sent, but the final receipt was interrupted. Confirming it with the video service...",
                  true,
                  Math.max(bytesUploaded, uploadedBytes),
                ),
              );
            }, BUNNY_COMPLETION_ACK_TIMEOUT_MS);
          }
        } else {
          armStallWatchdog();
        }
        if (bytesTotal > 0) {
          onProgress?.(uploadedBytes / bytesTotal, { uploadedBytes, totalBytes: bytesTotal });
        }
      },
      onSuccess: () => {
        if (settled) return;
        settled = true;
        clearRecoveryTimers();
        resolve();
      },
    });

    // tus-js-client stores the provider's upload URL. If this file is selected again
    // after a reload or after the recovery window, continue from Bunny's acknowledged
    // offset instead of creating a second upload and starting at zero.
    void upload.findPreviousUploads()
      .then((previous) => {
        if (settled) return;
        if (previous[0]) {
          hasStoredUpload = true;
          upload.resumeFromPreviousUpload(previous[0]);
        }
        upload.start();
      })
      .catch(() => {
        if (!settled) upload.start();
      });
  });
}

export type VideoUploadPhase =
  | "preparing"
  | "uploading"
  | "confirming"
  | "reconnecting"
  | "retrying";

export type VideoUploadHandlers = {
  onProgress?: (fraction: number, detail?: VideoProgress) => void;
  onPhaseChange?: (phase: VideoUploadPhase) => void;
};

/**
 * Uploads a feed-post video to Bunny Stream when it's configured, falling back to the
 * existing Cloudinary/local-disk path (same fallbackUrl contract as
 * uploadMediaDirectToCloudinary) when it isn't - mirrors requestSignature's own
 * 503-means-not-configured handling. Images never call this; only feed-post video goes
 * through Bunny (see lib/bunny-stream.ts's doc comment for why).
 *
 * The upload is done when the bytes are on Bunny. It does NOT wait for Bunny to finish
 * encoding, and nothing downstream should: the playback URL is a pure function of the
 * video id, so it can be written into a post immediately, and the player (see
 * components/posts/post-video-player.tsx) shows a quiet "processing" state and retries by
 * itself for the minute or two before the first rendition exists. Waiting here instead is
 * what used to park a creator on "Processing video... 80%" for as long as someone else's
 * encoder queue felt like taking.
 */
export async function uploadVideoDirect(
  file: File,
  fallbackUrl: string,
  handlers: VideoUploadHandlers = {},
): Promise<CloudinaryUploadResult> {
  const { onProgress, onPhaseChange } = handlers;
  onPhaseChange?.("preparing");
  onProgress?.(0.02);
  const cachedAuth = readCachedBunnyAuth(file);
  const auth = cachedAuth ?? await withUploadRetries(async () => {
    const signRes = await fetchWithTimeout("/api/upload/bunny-sign", {
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
    const signed = (await signRes.json()) as BunnyUploadAuth;
    cacheBunnyAuth(file, signed);
    return signed;
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
      file.size,
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
          (fraction, detail) => onProgress?.(0.04 + fraction * 0.96, detail),
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
    onPhaseChange?.("confirming");
    const confirmation = await confirmBunnyUpload(auth);
    if (confirmation === "accepted") {
      onProgress?.(1, { uploadedBytes: file.size, totalBytes: file.size });
      clearCachedBunnyAuth(file);
      let discarded = false;
      return {
        url: auth.playbackUrl,
        discard: () => {
          if (discarded) return;
          discarded = true;
          discardBunnyUpload(file, auth);
        },
      };
    }

    // A retryable interruption keeps both the Bunny video and its TUS URL so the retry
    // button (or reselecting after a reload) continues at the saved offset.
    const hasProviderProgress =
      error instanceof BunnyTusTransportError && error.bytesUploaded > 0;
    if (
      confirmation === "failed" ||
      (!(error instanceof BunnyTusTransportError && error.retryable) && !hasProviderProgress)
    ) {
      clearCachedBunnyAuth(file);
      discardBunnyUpload(file, auth);
    }
    throw error;
  }

  // Every byte is on Bunny from here on, and the playback URL was known before the upload
  // even started - so the composer is finished. Encoding continues on Bunny's side and
  // the player waits it out for whoever watches first, not for the person posting.
  onProgress?.(1);
  clearCachedBunnyAuth(file);

  // Dimensions and length deliberately come from whatever the browser measured while
  // framing the clip, not from the encoder - asking the encoder means waiting for it.
  let discarded = false;
  return {
    url: auth.playbackUrl,
    discard: () => {
      if (discarded) return;
      discarded = true;
      discardBunnyUpload(file, auth);
    },
  };
}
