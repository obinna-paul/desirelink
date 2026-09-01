"use client";

import Link from "next/link";
import useSWR from "swr";
import { Radio, Video } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceRing } from "@/components/ui/presence-avatar";
import type { LiveRingEntry } from "@/lib/live-streams";
import type { PresenceStatus } from "@/lib/presence";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load live streams.");
  const body = await res.json();
  return body.ring as LiveRingEntry[];
}

export function LiveRingRow({
  initialRing,
  self,
}: {
  initialRing: LiveRingEntry[];
  self: {
    username: string;
    displayName: string;
    avatarUrl: string;
    isProvider: boolean;
    presenceStatus: PresenceStatus;
    activeStreamId: string | null;
  } | null;
}) {
  const { data: ring } = useSWR("/api/live", fetcher, { fallbackData: initialRing, refreshInterval: 30_000 });
  const entries = ring ?? initialRing;

  if (entries.length === 0 && !self?.isProvider) return null;

  const selfStatus: PresenceStatus | null = self?.isProvider
    ? self.activeStreamId
      ? "live"
      : self.presenceStatus
    : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-20 gap-2 overflow-x-auto px-3 py-1 md:px-0" aria-label="Live and online now">
        {self?.isProvider && selfStatus && (
          <Link
            href={self.activeStreamId ? `/live/${self.activeStreamId}` : "/live/go"}
            className="flex w-14 shrink-0 flex-col items-center gap-1"
          >
            <PresenceRing status={selfStatus} size="h-12 w-12">
              <Avatar className="h-full w-full">
                <AvatarImage src={self.avatarUrl} alt="" />
                <AvatarFallback className="text-xs font-semibold">
                  {self.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {selfStatus === "live" ? (
                <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-destructive px-1 py-px text-[7px] font-bold uppercase text-destructive-foreground">
                  <Radio className="h-2 w-2" aria-hidden="true" />
                  Live
                </span>
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                  <Video className="h-2.5 w-2.5" aria-hidden="true" />
                </span>
              )}
            </PresenceRing>
            <span className="text-[10px] font-semibold text-foreground">
              {self.activeStreamId ? "You're live" : "Go live"}
            </span>
          </Link>
        )}

        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={entry.isLive ? `/live/${entry.streamId}` : `/profile/${entry.username}`}
            className="flex w-14 shrink-0 flex-col items-center gap-1"
          >
            <PresenceRing status={entry.isLive ? "live" : "online"} size="h-12 w-12">
              <Avatar className="h-full w-full">
                <AvatarImage src={entry.avatarUrl} alt="" />
                <AvatarFallback className="text-xs font-semibold">
                  {entry.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {entry.isLive && (
                <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-destructive px-1 py-px text-[7px] font-bold uppercase text-destructive-foreground">
                  <Radio className="h-2 w-2" aria-hidden="true" />
                  Live
                </span>
              )}
            </PresenceRing>
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">{entry.displayName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
