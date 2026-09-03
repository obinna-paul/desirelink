"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Check,
  Coins,
  ImagePlus,
  Lock,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  Video,
  X,
} from "lucide-react";

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
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#1e1226] via-[#170d1f] to-[#0e0812] text-white shadow-[0_30px_90px_rgba(0,0,0,0.55)] animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 focus:outline-none"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(192,132,252,0.4),transparent_70%)] blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.22),transparent_70%)] blur-2xl"
        />

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="relative z-[1] flex flex-col gap-6 p-7 sm:p-8">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Creator unlocked
            </p>
            <h2
              id="creator-welcome-title"
              className="mt-3 text-balance font-heading text-2xl font-semibold leading-tight text-white sm:text-[1.75rem]"
            >
              Welcome to the greener side of Udala
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              You&rsquo;re all set to start earning. Here&rsquo;s how to get going:
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {CHECKLIST.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-3 text-sm text-white/85">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                </span>
                <span className="pt-1 leading-5">{label}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-sm leading-6 text-white/70">
            <span className="flex shrink-0 items-center -space-x-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-2 ring-[#170d1f]">
                <Video className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-2 ring-[#170d1f]">
                <Briefcase className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              </span>
            </span>
            <p>
              You can also go live to earn from live streams, or list a paid service to get
              clients.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <Link
              href="/profile/edit"
              onClick={() => setOpen(false)}
              className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-4 text-sm font-semibold text-[#1c1024] shadow-[0_12px_30px_rgba(251,191,36,0.3)] transition-transform hover:brightness-105 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
              Complete my profile
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" /> Link copied
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" aria-hidden="true" /> Share profile link
                  </>
                )}
              </button>
              <p className="text-[11px] text-white/45">bring your fans to udala</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
