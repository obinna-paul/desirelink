"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Compass, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * "What's your spec?" nudge - shown from two surfaces that both render this same component:
 *
 * - "global": mounted once from app/(app)/layout.tsx, gated on
 *   `!profile.specTestNudgeShownAt && profile has no linked SpecTestResult` (see that
 *   layout's showSpecNudge) - the one-time, unprompted popup on next app open.
 * - "settings": opened on demand by clicking "What's your spec?" in profile settings
 *   (components/profile/spec-settings-row.tsx) when that profile hasn't taken it yet.
 *
 * Whichever surface shows it first marks it seen (POST on mount, same pattern as
 * CreatorWelcomeModal) - a mount here IS the "shown" event, so the other surface never shows
 * it again afterward either, satisfying "just once, ever" regardless of entry point.
 */
export function SpecTestNudgeModal({ variant, onClose }: { variant: "global" | "settings"; onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  const [deferred, setDeferred] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    fetch("/api/profile/spec-test-nudge-seen", { method: "POST" }).catch(() => null);
  }, []);

  function close() {
    setOpen(false);
    onClose?.();
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function handleTakeLater() {
    // The global popup is the one place a taker learns where to find this later - the
    // settings-triggered instance is opened from that exact screen, so repeating "find it in
    // settings" there would be pointless. Both close for good either way.
    if (variant === "global") {
      setDeferred(true);
      return;
    }
    close();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="spec-test-nudge-title"
      className="theme-clay fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={close}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl border border-border bg-card text-foreground shadow-lift animate-in zoom-in-95 duration-200 focus:outline-none"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {deferred ? (
          <div className="flex flex-col gap-4 p-7 sm:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-tint">
              <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
            <p className="text-[15px] leading-relaxed text-foreground">
              No problem. You can take the Spec Test anytime from{" "}
              <span className="font-semibold">Profile settings &rarr; What&rsquo;s your spec?</span>
            </p>
            <Button type="button" size="lg" onClick={close}>
              Got it
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 p-7 sm:p-8">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                The Spec Test
              </p>
              <h2 id="spec-test-nudge-title" className="mt-3 text-balance font-heading text-2xl font-semibold leading-tight text-foreground">
                What&rsquo;s your spec?
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A quick, playful read on what actually pulls you in and who tends to work for you -
                takes about 4 minutes.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild size="lg" onClick={close}>
                <Link href="/spec-test/quiz">Take it now</Link>
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={handleTakeLater}>
                Take it later
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
