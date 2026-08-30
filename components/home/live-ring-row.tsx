"use client";

import Link from "next/link";
import useSWR from "swr";
import { Radio, Video } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { LiveRingEntry } from "@/lib/live-streams";

const RING_COLORS = ["ring-primary", "ring-neon-pink", "ring-neon-cyan"];

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load live streams.");
  const body = await res.json();
  return body.ring as LiveRingEntry[];
}

function RingAvatar({
  avatarUrl,
  displayName,
  ringClassName,
  isLive,
}: {
  avatarUrl: string;
  displayName: string;
  ringClassName: string;
  isLive: boolean;
}) {
  return (
    <div className={cn("relative h-16 w-16 shrink-0 rounded-full p-[2.5px] ring-2 ring-offset-2 ring-offset-background", ringClassName)}>
      <Avatar className="h-full w-full">
        <AvatarImage src={avatarUrl} alt="" />
        <AvatarFallback className="text-sm font-semibold">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      {isLive && (
        <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-bold uppercase text-destructive-foreground">
          <Radio className="h-2.5 w-2.5" aria-hidden="true" />
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
    <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Live and online now">
      {entries.map((entry, index) => (
        <Link
          key={entry.id}
          href={entry.isLive ? `/live/${entry.streamId}` : `/profile/${entry.username}`}
          className="flex w-16 shrink-0 flex-col items-center gap-1.5"
        >
          <RingAvatar
            avatarUrl={entry.avatarUrl}
            displayName={entry.displayName}
            ringClassName={RING_COLORS[index % RING_COLORS.length]}
            isLive={entry.isLive}
          />
          <span className="w-full truncate text-center text-[11px] text-muted-foreground">{entry.displayName}</span>
        </Link>
      ))}

      {self?.isProvider && (
        <Link href="/live/go" className="flex w-16 shrink-0 flex-col items-center gap-1.5">
          <div className="relative h-16 w-16 shrink-0 rounded-full p-[2.5px] ring-2 ring-border ring-offset-2 ring-offset-background">
            <Avatar className="h-full w-full">
              <AvatarImage src={self.avatarUrl} alt="" />
              <AvatarFallback>
                <Video className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
          </div>
          <span className="text-[11px] font-semibold text-foreground">Host</span>
        </Link>
      )}
    </div>
  );
}
