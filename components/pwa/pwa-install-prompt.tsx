"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Download, EllipsisVertical, Share, Smartphone, SquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { isMobileDevice } from "@/lib/device";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<InstallChoice>;
  prompt(): Promise<void>;
}

type InstalledRelatedApp = {
  id?: string;
  platform: string;
  url?: string;
};

type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<InstalledRelatedApp[]>;
};

declare global {
  interface Window {
    __udalaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function isStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isAndroidDevice(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
  const [dismissedForVisit, setDismissedForVisit] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [installing, setInstalling] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(showIosGuide || showAndroidGuide, dialogRef);

  useEffect(() => {
    if (!isMobileDevice()) return;

    let cancelled = false;

    const revealCapturedPrompt = () => {
      if (window.__udalaInstallPrompt) {
        setInstallEvent(window.__udalaInstallPrompt);
        setPlatform("android");
      }
    };
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      window.__udalaInstallPrompt = promptEvent;
      setInstallEvent(promptEvent);
      setPlatform("android");
      setDismissedForVisit(false);
    };
    const handleInstalled = () => {
      window.__udalaInstallPrompt = null;
      setInstallEvent(null);
      setPlatform(null);
      setDismissedForVisit(true);
      setShowAndroidGuide(false);
      setShowIosGuide(false);
    };
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) handleInstalled();
    };

    const refreshAndroidInstallState = async () => {
      if (isStandaloneMode()) {
        handleInstalled();
        return;
      }

      const getInstalledRelatedApps = (navigator as NavigatorWithRelatedApps)
        .getInstalledRelatedApps;

      if (!getInstalledRelatedApps) {
        if (!cancelled) {
          setPlatform("android");
          revealCapturedPrompt();
        }
        return;
      }

      try {
        const relatedApps = await getInstalledRelatedApps.call(navigator);
        if (cancelled) return;

        const isInstalled = relatedApps.some((app) => app.platform === "webapp");
        if (isInstalled) {
          setInstallEvent(null);
          setPlatform(null);
          return;
        }

        setPlatform("android");
        revealCapturedPrompt();
      } catch {
        if (!cancelled) {
          setPlatform("android");
          revealCapturedPrompt();
        }
      }
    };

    const handlePageShow = () => {
      if (isAndroidDevice()) void refreshAndroidInstallState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isAndroidDevice()) {
        void refreshAndroidInstallState();
      }
    };

    if (isStandaloneMode()) handleInstalled();
    else if (isIosDevice()) setPlatform("ios");
    else if (isAndroidDevice()) void refreshAndroidInstallState();

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("udala:pwa-install-ready", revealCapturedPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    standaloneQuery.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("udala:pwa-install-ready", revealCapturedPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      standaloneQuery.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  useEffect(() => {
    if (!showIosGuide && !showAndroidGuide) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowIosGuide(false);
        setShowAndroidGuide(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAndroidGuide, showIosGuide]);

  async function handleInstall() {
    if (platform === "ios") {
      setShowIosGuide(true);
      return;
    }
    if (!installEvent) {
      setShowAndroidGuide(true);
      return;
    }
    if (installing) return;

    setInstalling(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      window.__udalaInstallPrompt = null;
      setInstallEvent(null);
      setDismissedForVisit(true);
    } finally {
      setInstalling(false);
    }
  }

  if (!platform || dismissedForVisit || isStandaloneMode()) return null;

  return (
    <>
      {!showIosGuide && !showAndroidGuide && (
        <aside
          aria-label="Install Udala"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[100] mx-auto flex max-w-md items-center gap-3 rounded-lg border border-white/10 bg-[#0a0a0b] p-2.5 pr-2 text-white shadow-[0_12px_35px_rgba(0,0,0,0.28)] motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:duration-300 lg:hidden"
        >
          <Image
            src="/icons/udala-greeting-192-v3.png"
            width={44}
            height={44}
            alt=""
            className="h-11 w-11 shrink-0 rounded-md object-cover"
          />
          <button
            type="button"
            onClick={() => void handleInstall()}
            disabled={installing}
            className="min-w-0 flex-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <span className="block text-sm font-semibold">Keep Udala close</span>
            <span className="mt-0.5 block text-xs leading-4 text-white/70">
              {platform === "ios"
                ? "Add it to your Home Screen."
                : installing
                  ? "Opening installer..."
                  : installEvent
                    ? "Install the app on your phone."
                    : "Reinstall Udala from Chrome."}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void handleInstall()}
            disabled={installing}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-bold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {platform === "ios" || !installEvent ? "How" : "Install"}
          </button>
          <button
            type="button"
            onClick={() => setDismissedForVisit(true)}
            aria-label="Not now"
            className="flex h-11 w-8 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </aside>
      )}

      {showIosGuide && (
        <div
          className="fixed inset-0 z-[110] flex items-end bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="w-full rounded-t-lg bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 text-[#1b141b] shadow-[0_-16px_50px_rgba(0,0,0,0.2)] focus:outline-none motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:max-w-sm sm:rounded-lg sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8f285d]">Install on iPhone</p>
                <h2 id="ios-install-title" className="mt-1 font-heading text-2xl font-semibold">
                  Add Udala to Home Screen
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                aria-label="Close install instructions"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#6f626b] hover:bg-[#f4edf1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f285d]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <ol className="mt-6 space-y-5">
              <li className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6edf2] text-[#8f285d]">
                  <Share className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-sm leading-6"><strong className="font-semibold">Tap Share</strong> in your browser.</p>
              </li>
              <li className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6edf2] text-[#8f285d]">
                  <SquarePlus className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-sm leading-6">Choose <strong className="font-semibold">Add to Home Screen</strong>.</p>
              </li>
              <li className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#171017] text-sm font-bold text-white">3</span>
                <p className="text-sm leading-6">Tap <strong className="font-semibold">Add</strong>, then open Udala from its new icon.</p>
              </li>
            </ol>

            <Button
              type="button"
              onClick={() => {
                setShowIosGuide(false);
                setDismissedForVisit(true);
              }}
              className="mt-7 w-full bg-[#050505] text-white hover:bg-[#1b1b1b]"
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      {showAndroidGuide && (
        <div
          className="fixed inset-0 z-[110] flex items-end bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="android-install-title"
          onClick={() => setShowAndroidGuide(false)}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="w-full rounded-t-lg bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 text-[#1b141b] shadow-[0_-16px_50px_rgba(0,0,0,0.2)] focus:outline-none motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:max-w-sm sm:rounded-lg sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8f285d]">
                  Install on Android
                </p>
                <h2 id="android-install-title" className="mt-1 font-heading text-2xl font-semibold">
                  Add Udala back to your phone
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAndroidGuide(false)}
                aria-label="Close install instructions"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#6f626b] hover:bg-[#f4edf1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f285d]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <ol className="mt-6 space-y-5">
              <li className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6edf2] text-[#8f285d]">
                  <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-sm leading-6">
                  Tap the <strong className="font-semibold">three-dot menu</strong> in Chrome.
                </p>
              </li>
              <li className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6edf2] text-[#8f285d]">
                  <Smartphone className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-sm leading-6">
                  Choose <strong className="font-semibold">Install app</strong> or <strong className="font-semibold">Add to Home screen</strong>.
                </p>
              </li>
              <li className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#171017] text-sm font-bold text-white">
                  3
                </span>
                <p className="text-sm leading-6">
                  Confirm <strong className="font-semibold">Install</strong>, then open Udala from its icon.
                </p>
              </li>
            </ol>

            <Button
              type="button"
              onClick={() => {
                setShowAndroidGuide(false);
                setDismissedForVisit(true);
              }}
              className="mt-7 w-full bg-[#050505] text-white hover:bg-[#1b1b1b]"
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
