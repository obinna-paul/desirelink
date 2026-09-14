"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import { feedMediaAspectRatio, type PostMediaItem } from "@/lib/post-shared";
import { getVideoTapZone } from "@/lib/video-playback";
import { PostVideoPlayer } from "@/components/posts/post-video-player";
import { Skeleton } from "@/components/ui/skeleton";

const IMAGE_RETRY_BASE_MS = 2_000;
const IMAGE_RETRY_MAX_MS = 30_000;

/**
 * A failed image load (bad network, a transient CDN hiccup) otherwise renders the browser's
 * bare broken-image icon on a black box - jarring, and reads as permanently broken even when
 * a retry a moment later would succeed. Shows the app's own skeleton instead and keeps
 * retrying with a capped exponential backoff (2s, 4s, 8s... up to 30s) so a bad connection
 * just looks like it's still loading, never broken.
 */
export function RetryingPostImage({
  item,
  alt,
  sizes = "(min-width: 1536px) 48rem, (min-width: 640px) 40rem, 100vw",
  quality = 92,
  fit = "cover",
}: {
  item: PostMediaItem;
  alt: string;
  sizes?: string;
  quality?: number;
  fit?: "cover" | "contain";
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const retryTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setStatus("loading");
    setAttempt(0);
  }, [item.url]);

  useEffect(
    () => () => {
      if (retryTimeoutRef.current !== null) window.clearTimeout(retryTimeoutRef.current);
    },
    [],
  );

  function scheduleRetry() {
    if (retryTimeoutRef.current !== null) window.clearTimeout(retryTimeoutRef.current);
    const delayMs = Math.min(IMAGE_RETRY_MAX_MS, IMAGE_RETRY_BASE_MS * 2 ** attempt);
    retryTimeoutRef.current = window.setTimeout(() => {
      setAttempt((current) => current + 1);
      setStatus("loading");
    }, delayMs);
  }

  // A cache-busting param forces a fresh request on retry - the browser (and some CDNs)
  // will otherwise keep serving the same failed response for the identical URL.
  const src = attempt === 0 ? item.url : `${item.url}${item.url.includes("?") ? "&" : "?"}retry=${attempt}`;

  return (
    <>
      {status !== "loaded" && <Skeleton className="absolute inset-0 rounded-none" />}
      <Image
        key={attempt}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={quality}
        className={cn(
          "transition-opacity duration-300",
          fit === "cover" ? "object-cover" : "object-contain",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
        onLoad={() => setStatus("loaded")}
        onError={() => {
          setStatus("error");
          scheduleRetry();
        }}
      />
    </>
  );
}

export function PostMediaCarousel({
  media,
  liked = false,
  onDoubleTapLike,
  imageAlt = "Post image",
}: {
  media: PostMediaItem[];
  liked?: boolean;
  onDoubleTapLike?: () => Promise<void> | void;
  imageAlt?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ index: number; time: number; x: number; y: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const hasMultiple = media.length > 1;

  useEffect(() => {
    if (!showLikeBurst) return;
    const timeout = window.setTimeout(() => setShowLikeBurst(false), 700);
    return () => window.clearTimeout(timeout);
  }, [showLikeBurst]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, media.length - 1)));
  }, [media.length]);

  if (media.length === 0) return null;

  function scrollToIndex(index: number) {
    const container = scrollerRef.current;
    if (!container) {
      setActiveIndex(index);
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    container.scrollTo({
      left: container.clientWidth * index,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    setActiveIndex(index);
  }

  function move(delta: number) {
    scrollToIndex((activeIndex + delta + media.length) % media.length);
  }

  function handleScroll() {
    const container = scrollerRef.current;
    if (!container || container.clientWidth === 0) return;
    const nextIndex = Math.round(container.scrollLeft / container.clientWidth);
    if (nextIndex !== activeIndex) {
      setActiveIndex(Math.max(0, Math.min(nextIndex, media.length - 1)));
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    tapStartRef.current = { x: event.clientX, y: event.clientY };
  }

  async function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = tapStartRef.current;
    tapStartRef.current = null;
    if (!start) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-post-carousel-control='true']")) return;

    const videoPlayer = target?.closest<HTMLElement>("[data-video-player='true']");
    if (
      videoPlayer &&
      getVideoTapZone(event.clientX, videoPlayer.getBoundingClientRect()) !== "center"
    ) {
      return;
    }

    if (
      !onDoubleTapLike ||
      liked ||
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 767px)").matches
    ) {
      return;
    }

    const horizontalMovement = Math.abs(event.clientX - start.x);
    const verticalMovement = Math.abs(event.clientY - start.y);
    if (horizontalMovement > 14 || verticalMovement > 14) return;

    const previousTap = lastTapRef.current;
    const currentTap = {
      index: activeIndex,
      time: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
    };

    if (
      previousTap &&
      currentTap.index === previousTap.index &&
      currentTap.time - previousTap.time < 280 &&
      Math.abs(currentTap.x - previousTap.x) < 28 &&
      Math.abs(currentTap.y - previousTap.y) < 28
    ) {
      lastTapRef.current = null;
      setShowLikeBurst(true);
      await onDoubleTapLike();
      return;
    }

    lastTapRef.current = currentTap;
  }

  return (
    <div className="overflow-hidden">
      <div
        ref={scrollerRef}
        className="relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-black md:overflow-x-hidden"
        onScroll={handleScroll}
        onPointerDownCapture={handlePointerDown}
        onPointerUpCapture={handlePointerUp}
      >
        {media.map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className="relative w-full shrink-0 snap-center bg-black"
            style={{ aspectRatio: feedMediaAspectRatio(item) }}
          >
            {item.type === "video" ? (
              <PostVideoPlayer
                key={item.url}
                src={item.url}
                naturalWidth={item.width}
                naturalHeight={item.height}
                crop={item.crop}
              />
            ) : (
              <RetryingPostImage
                item={item}
                alt={media.length > 1 ? `${imageAlt} ${index + 1} of ${media.length}` : imageAlt}
              />
            )}
          </div>
        ))}

        {showLikeBurst && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center motion-reduce:hidden">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-black/28 text-white/95 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-300">
              <Heart className="h-10 w-10 fill-current" aria-hidden="true" />
            </span>
          </div>
        )}

        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Previous media"
              onClick={() => move(-1)}
              data-post-carousel-control="true"
              className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-opacity hover:opacity-90 md:flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next media"
              onClick={() => move(1)}
              data-post-carousel-control="true"
              className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-opacity hover:opacity-90 md:flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="absolute right-2 top-2 rounded-full bg-background/85 px-2 py-1 text-xs font-semibold text-foreground backdrop-blur">
              {activeIndex + 1}/{media.length}
            </div>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="flex items-center justify-center gap-1.5 p-2">
          {media.map((item, index) => (
            <button
              key={`${item.url}-${index}`}
              type="button"
              aria-label={`Show media ${index + 1}`}
              data-post-carousel-control="true"
              onClick={() => scrollToIndex(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === activeIndex ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
