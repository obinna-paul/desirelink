"use client";

import { useEffect } from "react";

const PING_INTERVAL_MS = 60_000;

/** Invisible heartbeat mounted once in the app shell — see app/api/presence/ping. */
export function PresencePing() {
  useEffect(() => {
    function ping() {
      if (document.visibilityState !== "visible") return;
      fetch("/api/presence/ping", { method: "POST" }).catch(() => {});
    }

    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    document.addEventListener("visibilitychange", ping);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return null;
}
