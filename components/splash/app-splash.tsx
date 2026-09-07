"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/** How long the splash stays on screen before fading into the app. */
const DISPLAY_MS = 3000;
const FADE_MS = 300;

export function AppSplash() {
  const [hidden, setHidden] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const dismissedRef = useRef(false);

  function dismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFadingOut(true);
    setTimeout(() => setHidden(true), FADE_MS);
  }

  useEffect(() => {
    const timer = window.setTimeout(dismiss, DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (hidden) return null;

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
