"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  AVAILABILITY_CHANNEL,
  AVAILABILITY_STATUS_CLEARED_EVENT,
  AVAILABILITY_STATUS_UPDATED_EVENT,
  getPusherClient,
} from "@/lib/pusher-client";
import { AVAILABILITY_STATUS_LABELS } from "@/lib/availability-options";
import type { AvailabilityFeedItem } from "@/lib/availability";

const MAX_ITEMS = 20;
const PRUNE_INTERVAL_MS = 30_000;

export function AvailableNowSidebar({
  initialItems,
  baseNearbyCount,
  viewerProfileId,
}: {
  initialItems: AvailabilityFeedItem[];
  baseNearbyCount: number;
  viewerProfileId: string | null;
}) {
  const [items, setItems] = useState<AvailabilityFeedItem[]>(initialItems);

  useEffect(() => {
    const interval = setInterval(() => {
      setItems((prev) => prev.filter((item) => new Date(item.expiresAt).getTime() > Date.now()));
    }, PRUNE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channel = client.subscribe(AVAILABILITY_CHANNEL);

    function upsert(data: AvailabilityFeedItem) {
      if (data.id === viewerProfileId) return;
      setItems((prev) => [data, ...prev.filter((item) => item.id !== data.id)].slice(0, MAX_ITEMS));
    }

    function remove(data: { id: string }) {
      setItems((prev) => prev.filter((item) => item.id !== data.id));
    }

    channel.bind(AVAILABILITY_STATUS_UPDATED_EVENT, upsert);
    channel.bind(AVAILABILITY_STATUS_CLEARED_EVENT, remove);

    return () => {
      channel.unbind(AVAILABILITY_STATUS_UPDATED_EVENT, upsert);
      channel.unbind(AVAILABILITY_STATUS_CLEARED_EVENT, remove);
      client.unsubscribe(AVAILABILITY_CHANNEL);
    };
  }, [viewerProfileId]);

  const nearbyCount = baseNearbyCount + items.length;

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full bg-neon-cyan shadow-[0_0_8px_hsl(var(--neon-cyan))] motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active Now
        </h2>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{nearbyCount}</span> people near you are
        currently active
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one has set a status yet. Be the first with the lightning bolt in the top bar.
        </p>
      ) : (
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
      )}
    </>
  );
}
