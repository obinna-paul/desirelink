"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/** How long the splash stays on screen before fading into the app. */
const DISPLAY_MS = 3000;
const FADE_MS = 300;

/** Persisted so the splash shows once, ever, per device - not on every refresh or
 * app reopen. Deliberately localStorage (survives across tabs/sessions), not
 * sessionStorage (which would still replay it on every fresh tab). */
const STORAGE_KEY = "udala:splash-seen";

function hasSeenSplash(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private browsing or storage disabled - treat as unseen; showing the splash
    // an extra time is harmless, silently failing to persist is not a bug to surface.
    return false;
  }
}

function markSplashSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // See hasSeenSplash - never let a storage failure block dismissal.
  }
}

export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const dismissedRef = useRef(false);

  function dismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    markSplashSeen();
    setFadingOut(true);
    setTimeout(() => setVisible(false), FADE_MS);
  }

  // Decided client-side only, after mount: the server has no localStorage, so SSR
  // always renders nothing here - a first-time visitor sees the splash appear a
  // beat after hydration rather than in the initial HTML, and a returning visitor
  // never sees it at all, with no server/client markup mismatch either way.
  useEffect(() => {
    if (hasSeenSplash()) return;

    setVisible(true);
    const timer = window.setTimeout(dismiss, DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="presentation"
      onClick={dismiss}
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-white transition-opacity duration-300 ease-out ${fadingOut ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <Image
        src="/images/splash-logo.png"
        alt="udala"
        width={626}
        height={720}
        priority
        className="h-auto w-48 sm:w-56 md:w-64"
      />
    </div>
  );
}
