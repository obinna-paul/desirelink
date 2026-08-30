"use client";

import { useEffect, useState } from "react";
import { Heart, Gift, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "udala:live-viewer-onboarding-seen";

/**
 * One-time welcome card for first-time viewers, surfacing the two
 * interactions that have no visible affordance otherwise (double-tap to
 * heart) plus a nudge toward gifting and chat. Shown once ever per browser;
 * dismissal is entirely user-driven (tap outside, Escape, or the button) —
 * never a forced multi-step tour.
 */
export function LiveOnboarding() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable (private mode, blocked storage) - skip silently
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss is stable across renders
  }, [visible]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore - just means it may show again next time, harmless
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-onboarding-title"
      className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#0c0c0d] p-5 text-white shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="live-onboarding-title" className="text-base font-semibold">
          Welcome to the live room
        </h2>
        <ul className="mt-3 flex flex-col gap-3 text-sm text-white/70">
          <li className="flex items-start gap-2">
            <Heart className="mt-0.5 h-4 w-4 shrink-0 text-neon-pink" aria-hidden="true" fill="currentColor" />
            Double-tap the video to send a quick heart
          </li>
          <li className="flex items-start gap-2">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-neon-pink" aria-hidden="true" />
            Tap a heart amount to send a bigger gift
          </li>
          <li className="flex items-start gap-2">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-neon-pink" aria-hidden="true" />
            Say hi in chat — the host can see you
          </li>
        </ul>
        <Button type="button" size="sm" className="mt-4 w-full" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
