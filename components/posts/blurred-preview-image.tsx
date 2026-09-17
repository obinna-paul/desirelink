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
  const blurClassName = preview.cssBlur ? "blur-xl scale-110" : "";

  return (
    <Image
      key={src}
      src={src}
      alt=""
      fill
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
