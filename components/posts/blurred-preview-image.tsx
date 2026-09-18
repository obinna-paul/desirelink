"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { videoProcessingRetryDelayMs } from "@/lib/video-playback";
import type { LockedPostPreview } from "@/lib/posts";

/** A video's blurred paywall thumbnail is a Bunny Stream still frame, which - like the
 * playback manifest itself (see lib/video-playback.ts) - doesn't exist until the encoder
 * has processed the upload. A post can go live before that finishes, so the first fetch
 * can 404; retrying with the player's own backoff schedule catches up once the frame is
 * ready instead of leaving the paywall looking like a plain dark screen. */
const MAX_RETRIES = 5;

/**
 * `unoptimized` skips next/image's default behavior of fetching the source through
 * Next's own image-optimization proxy (a server-side request from Vercel's
 * infrastructure). Bunny's CDN hotlink-protects its hostnames by referrer, which that
 * proxied request doesn't carry - it 403s there the same way a bare curl does, even
 * though a real browser request (like the unlocked player's <video poster>) sails
 * through with the page's own referrer intact. Skipping the proxy makes the browser
 * fetch this image directly, the same way the poster already does. Cloudinary's blurred
 * stills don't need this - they're unaffected either way - but there's no reason to send
 * an already-tiny, pre-blurred asset through a second re-encode.
 */
export function BlurredPreviewImage({
  preview,
  sizes,
  className,
}: {
  preview: LockedPostPreview;
  sizes: string;
  className?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [preview.url]);

  if (failed) return null;

  const src =
    attempt === 0 ? preview.url : `${preview.url}${preview.url.includes("?") ? "&" : "?"}retry=${attempt}`;
  const blurClassName = preview.cssBlur ? "blur-md scale-110" : "";

  return (
    <Image
      key={src}
      src={src}
      alt=""
      fill
      unoptimized
      sizes={sizes}
      className={["object-cover", blurClassName, className].filter(Boolean).join(" ")}
      onError={() => {
        if (attempt >= MAX_RETRIES) {
          setFailed(true);
          return;
        }
        const delay = videoProcessingRetryDelayMs(attempt);
        setTimeout(() => setAttempt((current) => current + 1), delay);
      }}
    />
  );
}
