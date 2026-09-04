"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Coins,
  Crown,
  ImagePlus,
  Lock,
  Rocket,
  Share2,
  ShieldCheck,
  UserCircle2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/lib/use-focus-trap";

const CHECKLIST = [
  { icon: UserCircle2, label: "Set up your profile" },
  { icon: ShieldCheck, label: "Submit verification" },
  { icon: ImagePlus, label: "Post some free content" },
  { icon: Coins, label: "Set up your creator tiers for subscriptions" },
  { icon: Lock, label: "Post premium content" },
] as const;

/**
 * One-time celebratory unlock modal, shown the first time a profile becomes a Creator
 * (either by switching from Explorer, or by signing up as one) - see
 * Profile.creatorWelcomeShownAt. Mounted only when that flag is unset, so a mount here IS
 * the "shown" event; marking it seen happens immediately on mount rather than only on
 * dismiss/CTA click, so closing the tab mid-view still counts as seen.
 */
export function CreatorWelcomeModal({ profileHref }: { profileHref: string }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    fetch("/api/profile/creator-welcome-seen", { method: "POST" }).catch(() => null);
  }, []);

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

  async function handleShare() {
    const url = typeof window !== "undefined" ? new URL(profileHref, window.location.origin).toString() : profileHref;
    const canShare = typeof navigator !== "undefined" && "share" in navigator;

    if (canShare) {
      await navigator.share({ title: "My profile on udala", url }).catch(() => null);
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="creator-welcome-title"
      className="theme-clay fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl border border-border bg-card text-foreground shadow-lift animate-in zoom-in-95 duration-200 focus:outline-none"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex flex-col gap-6 p-7 sm:p-8">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              Creator unlocked
            </p>
            <h2
              id="creator-welcome-title"
              className="mt-3 text-balance font-heading text-2xl font-semibold leading-tight text-foreground sm:text-[1.75rem]"
            >
              Welcome to the greener side of Udala
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              You&rsquo;re all set to start earning. Here&rsquo;s how to get going:
            </p>
          </div>

          <ul className="flex flex-col gap-3.5">
            {CHECKLIST.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-foreground">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-tint">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3 rounded-2xl border border-accent-tint-border bg-accent-tint/50 p-3.5 text-sm leading-6 text-foreground/80">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-tint">
              <Rocket className="h-4 w-4 text-primary" aria-hidden="true" />
            </span>
            <p>
              You can also go live to earn from live streams, or list a paid service to get
              clients.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <Button asChild size="lg" onClick={() => setOpen(false)}>
              <Link href="/profile/edit" className="gap-1.5">
                Complete my profile
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>

            <div className="flex flex-col items-center gap-1.5">
              <Button type="button" variant="outline" size="lg" className="w-full gap-1.5" onClick={handleShare}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" /> Link copied
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" aria-hidden="true" /> Share profile link
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">bring your fans to udala</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
