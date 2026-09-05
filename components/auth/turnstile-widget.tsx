"use client";

import { useEffect, useId, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_KEY;

/** True at build time whenever a site key was baked in - forms use this to decide whether
 * to render the widget and require a token before submitting at all. */
export const isTurnstileEnabled = Boolean(SITE_KEY);

type TurnstileInstance = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Turnstile")));
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Renders a Cloudflare Turnstile challenge and reports the verification token up via
 * onVerify. Renders nothing when NEXT_PUBLIC_TURNSTILE_KEY isn't set (see
 * isTurnstileEnabled) - callers should check that flag rather than rendering this
 * unconditionally, so the surrounding form knows not to require a token either.
 */
export function TurnstileWidget({ onVerify, onExpire }: { onVerify: (token: string) => void; onExpire?: () => void }) {
  const containerId = useId();
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled) return;
        const container = document.getElementById(containerId);
        if (!container || !window.turnstile) return;

        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: SITE_KEY,
          callback: onVerify,
          "expired-callback": onExpire,
          "error-callback": onExpire,
        });
      })
      .catch((error) => console.error("[turnstile]", error));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // onVerify/onExpire are expected to be stable per mount - re-running this effect would
    // tear down and re-render the widget on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  if (!SITE_KEY) return null;

  return <div id={containerId} />;
}
