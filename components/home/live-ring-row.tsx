"use client";

import Link from "next/link";
import useSWR from "swr";
import { Radio, Video } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { LiveRingEntry } from "@/lib/live-streams";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load live streams.");
  const body = await res.json();
  return body.ring as LiveRingEntry[];
}

function RingAvatar({
  avatarUrl,
  displayName,
  isLive,
}: {
  avatarUrl: string;
  displayName: string;
  isLive: boolean;
}) {
  return (
    <div
      className={cn(
        "relative h-12 w-12 shrink-0 rounded-full p-[2px] ring-2",
        isLive ? "ring-primary" : "ring-border"
      )}
    >
      <Avatar className="h-full w-full">
        <AvatarImage src={avatarUrl} alt="" />
        <AvatarFallback className="text-xs font-semibold">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      {isLive && (
        <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-destructive px-1 py-px text-[7px] font-bold uppercase text-destructive-foreground">
          <Radio className="h-2 w-2" aria-hidden="true" />
          Live
        </span>
      )}
    </div>
  );
}

export function LiveRingRow({
  initialRing,
  self,
}: {
  initialRing: LiveRingEntry[];
  self: { username: string; displayName: string; avatarUrl: string; isProvider: boolean } | null;
}) {
  const { data: ring } = useSWR("/api/live", fetcher, { fallbackData: initialRing, refreshInterval: 30_000 });
  const entries = ring ?? initialRing;

  if (entries.length === 0 && !self?.isProvider) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-20 gap-2 overflow-x-auto px-3 py-1 md:px-0" aria-label="Live and online now">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={entry.isLive ? `/live/${entry.streamId}` : `/profile/${entry.username}`}
            className="flex w-14 shrink-0 flex-col items-center gap-1"
          >
            <RingAvatar avatarUrl={entry.avatarUrl} displayName={entry.displayName} isLive={entry.isLive} />
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">{entry.displayName}</span>
          </Link>
        ))}

        {self?.isProvider && (
          <Link href="/live/go" className="flex w-14 shrink-0 flex-col items-center gap-1">
            <div className="relative h-12 w-12 shrink-0 rounded-full p-[2px] ring-2 ring-border">
              <Avatar className="h-full w-full">
                <AvatarImage src={self.avatarUrl} alt="" />
                <AvatarFallback>
                  <Video className="h-4 w-4 text-primary" aria-hidden="true" />
                </AvatarFallback>
              </Avatar>
            </div>
            <span className="text-[10px] font-semibold text-foreground">Go live</span>
          </Link>
        )}
      </div>
    </div>
  );
}
