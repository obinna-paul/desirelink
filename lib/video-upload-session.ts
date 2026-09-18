"use client";

/**
 * Owns an in-flight media upload for the whole time the tab is open, rather than for as
 * long as the composer happens to be on screen.
 *
 * `/create` is a route. Tapping Home, Messages, or anything else in the nav unmounts the
 * composer, and everything it held in React state went with it: the progress, the file,
 * the knowledge that an upload was even happening. The bytes kept moving - nothing
 * cancels an XHR just because a component unmounted - but no one was left listening, so
 * returning to Create showed an empty composer and the only option was to start over.
 *
 * Keeping the upload here, in module scope, is what fixes that. A module is evaluated
 * once per page and outlives every mount, so the upload runs to completion whether or not
 * anyone is watching, and a composer that mounts later simply reads where things got to.
 *
 * This survives navigation inside the app, which is what people actually do while waiting.
 * It cannot survive a full page reload: a browser cannot hold a file open across one, and
 * no web upload can continue through it.
 */

import { useSyncExternalStore } from "react";

import type { PostDisplayAspectRatio, PostMediaItem, VideoCrop } from "@/lib/post-shared";
import {
  discardVideoUpload,
  uploadMediaDirectToCloudinary,
  uploadVideoDirect,
  type VideoUploadPhase,
} from "@/lib/client-uploads";
import {
  checkReportedVideoDuration,
  formatVideoDuration,
} from "@/lib/video-upload-constraints";

export type PendingMediaReview = {
  file: File;
  kind: "image" | "video";
  metadataDetected: boolean;
  imagePurpose?: "post-image" | "post-image-normalize";
  /** What the browser read off the file at selection, when it could. */
  durationSeconds?: number;
};

export type PreparedMediaReview = {
  pending: PendingMediaReview;
  adjustedFile?: File;
  crop?: VideoCrop;
  /** Captured when review is confirmed so background processing and retries cannot
   * replace the creator's chosen frame with the composer's current/default frame. */
  displayAspectRatio: PostDisplayAspectRatio;
  /** What the browser measured while framing the video. The video service reports its own
   * dimensions and length only once it has encoded the file, which is deliberately not
   * something anyone waits for, so these are what the post is built from. */
  videoMeta?: { width: number; height: number; durationSeconds: number };
};

export type UploadedMedia = PostMediaItem & {
  metadataDetected: boolean;
  displayAspectRatio: PostDisplayAspectRatio;
  /** A blob URL for the file the creator already has on this device. The composer uses it
   * immediately instead of waiting for Bunny's HLS playlist to appear after upload. It is
   * never included in the post payload. */
  previewUrl?: string;
  /** Releases the browser's reference to the potentially very large local video. */
  releasePreview?: () => void;
  /** Removes an uploaded Bunny object if the creator drops it before publishing. */
  discard?: () => void;
};

export type ActiveUpload = {
  fileName: string;
  phase: VideoUploadPhase | "image";
  label: string;
  /** 0-100, or null while nothing measurable has happened yet. */
  progress: number | null;
  bytesUploaded: number;
  totalBytes: number;
  /** Smoothed transfer speed and ETA are omitted until enough bytes have moved. */
  bytesPerSecond: number | null;
  etaSeconds: number | null;
};

export type FailedUpload = {
  item: PreparedMediaReview;
  remaining: PreparedMediaReview[];
};

export type UploadSessionState = {
  active: ActiveUpload | null;
  /** Finished uploads no composer has taken into its draft yet. */
  completed: UploadedMedia[];
  failed: FailedUpload | null;
  error: string | null;
};

/** The composer's choices at the moment an upload starts. They are captured rather than
 * read later, because "later" may be a moment when no composer is mounted to read from. */
export type UploadContext = {
  maxDurationSeconds: number;
};

const EMPTY_STATE: UploadSessionState = {
  active: null,
  completed: [],
  failed: null,
  error: null,
};

let state: UploadSessionState = EMPTY_STATE;
let queue: PreparedMediaReview[] = [];
let running = false;
let progressSample: { at: number; bytes: number; bytesPerSecond: number | null } | null = null;
let lastProgressRenderAt = 0;
const listeners = new Set<() => void>();

function setState(patch: Partial<UploadSessionState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function getUploadSessionState(): UploadSessionState {
  return state;
}

export function subscribeToUploadSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Server renders have no upload in flight by definition, so they get the empty state. */
export function useUploadSession(): UploadSessionState {
  return useSyncExternalStore(
    subscribeToUploadSession,
    getUploadSessionState,
    () => EMPTY_STATE,
  );
}

function describeVideoPhase(phase: VideoUploadPhase): string {
  if (phase === "reconnecting") return "Upload paused. Reconnecting...";
  if (phase === "retrying") return "Video service interrupted. Resuming...";
  if (phase === "confirming") return "Confirming your video...";
  if (phase === "preparing") return "Preparing video...";
  return "Uploading video...";
}

function createLocalVideoPreview(file: File): {
  previewUrl?: string;
  releasePreview?: () => void;
} {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return {};

  let previewUrl: string;
  try {
    previewUrl = URL.createObjectURL(file);
  } catch {
    // Privacy-restricted browsers can block blob URLs. The remote playback URL remains a
    // complete fallback, and a preview optimization must never turn a valid upload into
    // an error after Bunny has already accepted it.
    return {};
  }
  let released = false;
  return {
    previewUrl,
    releasePreview: () => {
      if (released) return;
      released = true;
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        // The browser also drops blob URLs automatically when the page closes.
      }
    },
  };
}

function trackProgress(
  fraction: number,
  detail?: { uploadedBytes: number; totalBytes: number },
) {
  const active = state.active;
  if (!active) return;
  const now = Date.now();
  const next = Math.max(active.progress ?? 0, Math.round(fraction * 100));
  let bytesPerSecond = active.bytesPerSecond;
  let etaSeconds = active.etaSeconds;
  const bytesUploaded = detail
    ? Math.max(active.bytesUploaded, detail.uploadedBytes)
    : active.bytesUploaded;
  const totalBytes = detail?.totalBytes ?? active.totalBytes;

  if (detail && progressSample && detail.uploadedBytes > progressSample.bytes) {
    const elapsedSeconds = (now - progressSample.at) / 1000;
    if (elapsedSeconds >= 0.75) {
      const currentSpeed = (detail.uploadedBytes - progressSample.bytes) / elapsedSeconds;
      bytesPerSecond = progressSample.bytesPerSecond
        ? progressSample.bytesPerSecond * 0.7 + currentSpeed * 0.3
        : currentSpeed;
      progressSample = { at: now, bytes: detail.uploadedBytes, bytesPerSecond };
    }
  } else if (detail && (!progressSample || detail.uploadedBytes > progressSample.bytes)) {
    progressSample = { at: now, bytes: detail.uploadedBytes, bytesPerSecond };
  }

  if (bytesPerSecond && bytesPerSecond > 0 && totalBytes > bytesUploaded) {
    etaSeconds = Math.ceil((totalBytes - bytesUploaded) / bytesPerSecond);
  } else if (bytesUploaded >= totalBytes && totalBytes > 0) {
    etaSeconds = 0;
  }

  // Percentage changes can be far apart on a 50GB file. Refresh byte/speed details at a
  // measured cadence as well, without re-rendering on every low-level XHR progress event.
  if (next === active.progress && now - lastProgressRenderAt < 1_000) return;
  lastProgressRenderAt = now;
  setState({
    active: {
      ...active,
      progress: next,
      bytesUploaded,
      totalBytes,
      bytesPerSecond,
      etaSeconds,
    },
  });
}

async function uploadOne(
  item: PreparedMediaReview,
  context: UploadContext,
): Promise<"uploaded" | "failed"> {
  const {
    pending,
    adjustedFile,
    crop,
    videoMeta,
    displayAspectRatio: reviewedAspectRatio,
  } = item;
  const file = adjustedFile ?? pending.file;
  const isVideo = pending.kind === "video";
  const preUploadDuration = checkReportedVideoDuration(
    videoMeta?.durationSeconds ?? pending.durationSeconds,
    context.maxDurationSeconds,
  );

  // Never upload a file and only then reject it for a duration the browser already knew.
  // That creates the exact false-failure experience where Bunny has the video but the app
  // says the upload failed. Validate the known duration before a single byte is sent.
  if (isVideo && !preUploadDuration.withinLimit) {
    setState({
      error: `Videos must be ${formatVideoDuration(context.maxDurationSeconds)} or shorter.`,
    });
    return "failed";
  }

  progressSample = null;
  lastProgressRenderAt = 0;

  setState({
    active: {
      fileName: file.name,
      phase: isVideo ? "preparing" : "image",
      label: isVideo ? "Preparing video..." : "Uploading photo...",
      progress: null,
      bytesUploaded: 0,
      totalBytes: file.size,
      bytesPerSecond: null,
      etaSeconds: null,
    },
    error: null,
  });

  try {
    const media = isVideo
      ? await uploadVideoDirect(file, "/api/upload/post-media", {
          onProgress: trackProgress,
          onPhaseChange: (phase) => {
            const active = state.active;
            if (!active) return;
            setState({ active: { ...active, phase, label: describeVideoPhase(phase) } });
          },
        })
      : await uploadMediaDirectToCloudinary(
          file,
          adjustedFile ? "post-image" : pending.imagePurpose ?? "post-image",
          "/api/upload/post-media",
          trackProgress,
        );

    const duration = checkReportedVideoDuration(
      media.durationSeconds ?? videoMeta?.durationSeconds ?? pending.durationSeconds,
      context.maxDurationSeconds,
    );
    const localPreview: ReturnType<typeof createLocalVideoPreview> = isVideo
      ? createLocalVideoPreview(file)
      : {};
    let discarded = false;
    const discard =
      media.discard || localPreview.releasePreview
        ? () => {
            if (discarded) return;
            discarded = true;
            localPreview.releasePreview?.();
            media.discard?.();
          }
        : undefined;

    setState({
      completed: [
        ...state.completed,
        {
          ...media,
          width: media.width ?? videoMeta?.width,
          height: media.height ?? videoMeta?.height,
          // A provider-reported duration discovered only after transfer belongs to post
          // validation, not upload failure. Keep the accepted media and its real duration.
          durationSeconds: duration.durationSeconds,
          type: isVideo ? "video" : "image",
          displayAspectRatio: reviewedAspectRatio,
          metadataDetected: pending.metadataDetected,
          crop,
          ...localPreview,
          discard,
        },
      ],
    });
    return "uploaded";
  } catch (error) {
    setState({
      error: error instanceof Error ? error.message : "Upload failed. Please try again.",
    });
    return "failed";
  }
}

/** Uploads run one at a time so a phone's connection carries one file as fast as it can
 * rather than several slowly. Anything handed over while one is in flight waits its turn
 * here - never dropped. */
async function drainQueue(context: UploadContext) {
  running = true;
  const warnBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = "";
  };
  // In-app navigation is safe because this module remains alive. A full refresh or tab
  // close releases the browser's File handle, so let the browser guard against an
  // accidental dismissal while a large upload is still moving.
  window.addEventListener("beforeunload", warnBeforeUnload);
  try {
    while (queue.length > 0) {
      const [item, ...rest] = queue;
      queue = rest;
      if ((await uploadOne(item, context)) === "failed") {
        setState({ active: null, failed: { item, remaining: queue } });
        queue = [];
        return;
      }
    }
  } finally {
    window.removeEventListener("beforeunload", warnBeforeUnload);
    running = false;
    if (state.active) setState({ active: null });
  }
}

function enqueue(items: PreparedMediaReview[], context: UploadContext) {
  if (items.length === 0) return;
  queue = [...queue, ...items];
  setState({ failed: null, error: null });
  if (!running) void drainQueue(context);
}

/** Starts uploading the reviewed items. Returns immediately: the work continues in module
 * scope, so navigating away from the composer does not touch it. */
export function startUploads(items: PreparedMediaReview[], context: UploadContext): void {
  enqueue(items, context);
}

export function retryFailedUpload(context: UploadContext): void {
  const failed = state.failed;
  if (!failed) return;
  enqueue([failed.item, ...failed.remaining], context);
}

/** Drops the item that failed and carries on with whatever was queued behind it. */
export function skipFailedUpload(context: UploadContext): void {
  const failed = state.failed;
  if (!failed) return;
  if (failed.item.pending.kind === "video") {
    void discardVideoUpload(failed.item.adjustedFile ?? failed.item.pending.file);
  }
  setState({ failed: null, error: null });
  enqueue(failed.remaining, context);
}

/**
 * Hands finished uploads to the composer that is currently mounted, and clears them from
 * the session so the next mount does not add the same media twice.
 */
export function drainCompletedMedia(): UploadedMedia[] {
  if (state.completed.length === 0) return [];
  const completed = state.completed;
  setState({ completed: [] });
  return completed;
}

/** Returns media claimed by a composer to the session when that composer unmounts before
 * publishing. This closes the small handoff gap between "upload completed" and "post
 * published": navigating away at either point keeps the already-uploaded draft intact. */
export function retainCompletedMedia(items: UploadedMedia[]): void {
  if (items.length === 0) return;
  const knownUrls = new Set(state.completed.map((item) => item.url));
  const additions = items.filter((item) => !knownUrls.has(item.url));
  if (additions.length > 0) {
    setState({ completed: [...state.completed, ...additions] });
  }
}

export function clearUploadError(): void {
  if (state.error !== null) setState({ error: null });
}

/** Called once a post is published: the draft is gone, so anything still held for it is
 * stale. An upload that is genuinely still running is left alone to finish. */
export function resetUploadSession(): void {
  queue = [];
  state.completed.forEach((item) => item.releasePreview?.());
  setState({ completed: [], failed: null, error: null });
}
