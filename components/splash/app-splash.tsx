"use client";

import { useEffect, useRef, useState } from "react";

/** Matches manifest.json's background_color/theme_color so there's no color flash
 * between this splash and the native PWA launch background it replaces. */
const SPLASH_BACKGROUND = "#0c0614";

/** Safety net if autoplay is blocked or the video never fires "ended" - the clip itself
 * runs ~8s, so this guarantees the app is never stuck behind the splash. */
const MAX_DISPLAY_MS = 9000;

export function AppSplash() {
  const [hidden, setHidden] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const dismissedRef = useRef(false);

  function dismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFadingOut(true);
    setTimeout(() => setHidden(true), 300);
  }

  useEffect(() => {
    const timer = window.setTimeout(dismiss, MAX_DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (hidden) return null;

  return (
    <div
      role="presentation"
      onClick={dismiss}
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-300 ease-out ${fadingOut ? "pointer-events-none opacity-0" : "opacity-100"}`}
      style={{ backgroundColor: SPLASH_BACKGROUND }}
    >
      <video
        className="h-full w-full object-contain"
        autoPlay
        muted
        playsInline
        onEnded={dismiss}
        onError={dismiss}
      >
        <source src="/videos/splash-logo.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
