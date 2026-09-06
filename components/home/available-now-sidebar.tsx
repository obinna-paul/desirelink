"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  AVAILABILITY_CHANNEL,
  AVAILABILITY_STATUS_CLEARED_EVENT,
  AVAILABILITY_STATUS_UPDATED_EVENT,
  getPusherClient,
} from "@/lib/pusher-client";
import { AVAILABILITY_STATUS_LABELS } from "@/lib/availability-options";
import type { NearbyActiveSnapshot } from "@/lib/availability";

const REFRESH_INTERVAL_MS = 30_000;

export function AvailableNowSidebar({
  initialSnapshot,
  viewerProfileId,
}: {
  initialSnapshot: NearbyActiveSnapshot;
  viewerProfileId: string | null;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  const refresh = useCallback(async () => {
    if (!viewerProfileId || document.visibilityState !== "visible") return;
    try {
      const response = await fetch("/api/availability/nearby", { cache: "no-store" });
      if (!response.ok) return;
      setSnapshot((await response.json()) as NearbyActiveSnapshot);
    } catch {
      // Keep the last accurate snapshot during a brief connection loss.
    }
  }, [viewerProfileId]);

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channel = client.subscribe(AVAILABILITY_CHANNEL);

    function refreshNearby() {
      void refresh();
    }

    channel.bind(AVAILABILITY_STATUS_UPDATED_EVENT, refreshNearby);
    channel.bind(AVAILABILITY_STATUS_CLEARED_EVENT, refreshNearby);

    return () => {
      channel.unbind(AVAILABILITY_STATUS_UPDATED_EVENT, refreshNearby);
      channel.unbind(AVAILABILITY_STATUS_CLEARED_EVENT, refreshNearby);
      client.unsubscribe(AVAILABILITY_CHANNEL);
    };
  }, [refresh, viewerProfileId]);

  const { items, locationReady, onlineCount, radiusKm } = snapshot;
  const peopleLabel = onlineCount === 1 ? "person" : "people";

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full bg-neon-cyan shadow-[0_0_8px_hsl(var(--neon-cyan))] motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active nearby
        </h2>
      </div>

      {locationReady ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{onlineCount}</span> {peopleLabel} within{" "}
          {radiusKm} km {onlineCount === 1 ? "is" : "are"} online now
        </p>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          <Link href="/profile/edit#location" className="font-semibold text-foreground hover:underline">
            Add your location
          </Link>{" "}
          to see who is online within {radiusKm} km.
        </p>
      )}

      {locationReady && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {onlineCount > 0
            ? "Nearby members are online. Their availability notes will appear here when shared."
            : "No one nearby is online right now."}
        </p>
      ) : locationReady ? (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/profile/${item.username}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5 transition-colors hover:border-neon-pink/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {AVAILABILITY_STATUS_LABELS[item.status]}
                  </p>
                </div>
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-neon-cyan motion-safe:animate-pulse"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
