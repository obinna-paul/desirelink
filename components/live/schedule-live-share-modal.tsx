"use client";

import { useEffect, useRef, useState } from "react";
import { Check, PartyPopper, Share2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/lib/use-focus-trap";

function formatScheduledFor(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ScheduleLiveShareModal({
  stream,
  onClose,
}: {
  stream: { id: string; title: string; scheduledFor: string };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, dialogRef);

  const url = typeof window !== "undefined" ? new URL(`/live/${stream.id}`, window.location.origin).toString() : `/live/${stream.id}`;

  useEffect(() => {
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
  }, [onClose]);

  async function handleCopy() {
    const canShare = typeof navigator !== "undefined" && "share" in navigator;
    if (canShare) {
      await navigator.share({ title: stream.title, url }).catch(() => null);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-share-title"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-lift focus:outline-none sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <PartyPopper className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
        <h2 id="schedule-share-title" className="mt-3 font-heading text-xl font-semibold text-foreground">
          Your live is scheduled
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {stream.title} &middot; {formatScheduledFor(stream.scheduledFor)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Share this link so people know where to watch - it turns into your live room the moment you start.
        </p>

        <div className="mt-4 truncate rounded-xl border border-border bg-background px-3 py-2 text-left text-xs text-muted-foreground">
          {url}
        </div>

        <Button type="button" className="mt-4 w-full gap-1.5" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" /> Link copied
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" aria-hidden="true" /> Copy link
            </>
          )}
        </Button>
        <Button type="button" variant="ghost" className="mt-2 w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
