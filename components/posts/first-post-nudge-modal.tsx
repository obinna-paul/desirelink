"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ImagePlus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/lib/use-focus-trap";

export const FIRST_POST_NUDGE_ENGAGED_DELAY_MS = 25_000;
export const FIRST_POST_NUDGE_FALLBACK_DELAY_MS = 45_000;
export const FIRST_POST_NUDGE_SCROLL_THRESHOLD_PX = 320;

function storageKey(profileId: string) {
  return `udala:first-post-nudge-shown:${profileId}`;
}

/**
 * A delayed, one-time prompt for profiles with no posts. The server decides eligibility;
 * this component owns only considerate timing and the immediate browser-side dedupe guard.
 */
export function FirstPostNudgeModal({ profileId }: { profileId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef(pathname);
  const initialPathRef = useRef(pathname);
  const engagedRef = useRef(false);
  const earliestElapsedRef = useRef(false);
  const fallbackElapsedRef = useRef(false);
  const shownRef = useRef(false);
  const attemptRevealRef = useRef<() => void>(() => undefined);
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    const key = storageKey(profileId);
    if (window.localStorage.getItem(key)) return;

    initialPathRef.current = currentPathRef.current;
    engagedRef.current = false;
    earliestElapsedRef.current = false;
    fallbackElapsedRef.current = false;
    shownRef.current = false;
    let accumulatedScroll = 0;
    let lastScrollY = window.scrollY;
    let activeStartedAt = 0;
    let earliestRemaining = FIRST_POST_NUDGE_ENGAGED_DELAY_MS;
    let fallbackRemaining = FIRST_POST_NUDGE_FALLBACK_DELAY_MS;
    let earliestTimer: number | null = null;
    let fallbackTimer: number | null = null;

    async function claimAndReveal() {
      try {
        const response = await fetch("/api/profile/first-post-nudge-seen", { method: "POST" });
        if (!response.ok) {
          shownRef.current = false;
          return;
        }

        const claim = (await response.json()) as { show?: boolean };
        // A false claim means another tab/device already showed it, or a post was created
        // after this layout loaded. Remember that locally so this stale mount stays quiet.
        window.localStorage.setItem(key, "1");
        if (!claim.show || currentPathRef.current === "/create") return;
        setOpen(true);
      } catch {
        // A failed claim never opens the modal. A later engagement signal (or next visit)
        // can retry without risking a prompt that the server could not mark once-ever.
        shownRef.current = false;
      }
    }

    function attemptReveal() {
      const timingReady = fallbackElapsedRef.current || (earliestElapsedRef.current && engagedRef.current);
      if (
        !timingReady ||
        shownRef.current ||
        window.localStorage.getItem(key) ||
        currentPathRef.current === "/create" ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      shownRef.current = true;
      void claimAndReveal();
    }

    attemptRevealRef.current = attemptReveal;

    function onScroll() {
      const nextScrollY = window.scrollY;
      accumulatedScroll += Math.abs(nextScrollY - lastScrollY);
      lastScrollY = nextScrollY;
      if (accumulatedScroll < FIRST_POST_NUDGE_SCROLL_THRESHOLD_PX) return;
      engagedRef.current = true;
      attemptReveal();
    }

    function clearTimers() {
      if (earliestTimer !== null) window.clearTimeout(earliestTimer);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      earliestTimer = null;
      fallbackTimer = null;
    }

    function pauseTimers() {
      if (activeStartedAt) {
        const activeElapsed = Date.now() - activeStartedAt;
        if (!earliestElapsedRef.current) earliestRemaining = Math.max(0, earliestRemaining - activeElapsed);
        if (!fallbackElapsedRef.current) fallbackRemaining = Math.max(0, fallbackRemaining - activeElapsed);
      }
      activeStartedAt = 0;
      clearTimers();
    }

    function startTimers() {
      if (document.visibilityState !== "visible" || shownRef.current || activeStartedAt) return;
      activeStartedAt = Date.now();

      if (!earliestElapsedRef.current) {
        earliestTimer = window.setTimeout(() => {
          earliestElapsedRef.current = true;
          earliestTimer = null;
          attemptReveal();
        }, earliestRemaining);
      }
      if (!fallbackElapsedRef.current) {
        fallbackTimer = window.setTimeout(() => {
          fallbackElapsedRef.current = true;
          fallbackTimer = null;
          attemptReveal();
        }, fallbackRemaining);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        startTimers();
        attemptReveal();
      } else {
        pauseTimers();
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    startTimers();

    return () => {
      pauseTimers();
      attemptRevealRef.current = () => undefined;
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [profileId]);

  useEffect(() => {
    if (pathname !== initialPathRef.current) engagedRef.current = true;
    currentPathRef.current = pathname;
    // Never cover the composer if someone reaches it before the prompt is due.
    if (pathname === "/create") setOpen(false);
    attemptRevealRef.current();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-post-nudge-title"
      aria-describedby="first-post-nudge-description"
      className="theme-clay fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200 motion-reduce:animate-none"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-3xl border border-border bg-card text-foreground shadow-lift animate-in zoom-in-95 duration-200 focus:outline-none motion-reduce:animate-none"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close first post reminder"
          className="absolute right-3 top-3 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex flex-col gap-6 p-7 pt-8 sm:p-8">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-tint">
              <ImagePlus className="h-6 w-6 text-primary" aria-hidden="true" />
            </span>
            <p className="mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Give them something to notice
            </p>
            <h2
              id="first-post-nudge-title"
              className="mt-3 text-balance font-heading text-2xl font-semibold leading-tight text-foreground"
            >
              Ready for your first post?
            </h2>
            <p id="first-post-nudge-description" className="mt-2 text-base leading-6 text-muted-foreground">
              A post helps potential matches discover you and gives them an easy glimpse of your
              personality before they say hello.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button asChild size="lg" onClick={() => setOpen(false)}>
              <Link href="/create" className="gap-2">
                Create my first post
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
              I&rsquo;ll do it later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
