"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { hasSeenSplash, markSplashSeen } from "@/lib/app-splash-storage";
import { isMobileDevice } from "@/lib/device";

/** How long the splash stays on screen before fading into the app. */
const DISPLAY_MS = 3000;
const FADE_MS = 300;

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

  // Decided client-side only, after mount: the server has no sessionStorage (or a way
  // to know the device) to check, so SSR always renders nothing here - the splash
  // appears a beat after hydration on a real app open rather than in the initial HTML,
  // and never appears at all on desktop, a refresh, a resume from background, or any
  // other reload within the same browsing context - either way there's no server/client
  // markup mismatch. This is a mobile-app-style greeting, not something a laptop
  // browser tab needs - desktop just opens straight into the app, like before.
  useEffect(() => {
    if (!isMobileDevice() || hasSeenSplash()) return;

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
