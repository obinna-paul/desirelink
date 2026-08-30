"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { feedMediaAspectRatio, type PostMediaItem } from "@/lib/post-shared";
import { PostVideoPlayer } from "@/components/posts/post-video-player";

export function PostMediaCarousel({ media }: { media: PostMediaItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (media.length === 0) return null;

  const active = media[activeIndex];
  const hasMultiple = media.length > 1;

  function move(delta: number) {
    setActiveIndex((current) => (current + delta + media.length) % media.length);
  }

  return (
    <div className="overflow-hidden">
      <div className="relative w-full bg-black" style={{ aspectRatio: feedMediaAspectRatio(active) }}>
        {active.type === "video" ? (
          <PostVideoPlayer key={active.url} src={active.url} />
        ) : (
          <Image
            src={active.url}
            alt=""
            fill
            sizes="(min-width: 1536px) 48rem, (min-width: 640px) 40rem, 100vw"
            className="object-cover"
          />
        )}

        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Previous media"
              onClick={() => move(-1)}
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-opacity hover:opacity-90"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next media"
              onClick={() => move(1)}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-opacity hover:opacity-90"
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
              onClick={() => setActiveIndex(index)}
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
