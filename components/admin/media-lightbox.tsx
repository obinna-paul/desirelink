"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { useFocusTrap } from "@/lib/use-focus-trap";

export type LightboxMedia = { url: string; type: "image" | "video"; alt?: string } | null;

/** Full-size in-page viewer for a thumbnail - reused by the locked-content viewer (premium
 * post media) and the verification queue (ID photo/selfie), so an admin can actually see
 * what they're reviewing instead of squinting at a small grid thumbnail. */
export function MediaLightbox({ media, onClose }: { media: LightboxMedia; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(Boolean(media), dialogRef);

  useEffect(() => {
    if (!media) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [media, onClose]);

  if (!media) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed right-4 top-4 z-[91] flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-full max-w-full items-center justify-center focus:outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        {media.type === "video" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- admin-only review tool, source has no captions to provide
          <video src={media.url} controls autoPlay className="max-h-[90vh] max-w-full rounded-lg" />
        ) : (
          // Plain <img>, not next/image - the viewport is unknown ahead of time (full available
          // screen space) and this is a one-off admin viewer, not a layout that benefits from
          // next/image's responsive sizing.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt={media.alt ?? ""} className="max-h-[90vh] max-w-full rounded-lg object-contain" />
        )}
      </div>
    </div>
  );
}
