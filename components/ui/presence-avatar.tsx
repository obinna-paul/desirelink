"use client";

import * as React from "react";
import Link from "next/link";
import { Radio, Video } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { PresenceStatus } from "@/lib/presence";

const RING_CLASS: Record<PresenceStatus, string> = {
  offline: "ring-presence-offline",
  online: "ring-presence-online",
  live: "ring-presence-live",
};

export function getPresenceDestination({
  username,
  status,
  activeStreamId,
}: {
  username: string;
  status: PresenceStatus;
  activeStreamId: string | null;
}) {
  return status === "live" && activeStreamId
    ? `/live/${activeStreamId}`
    : `/profile/${username}`;
}

const INDICATOR_POSITION = {
  "top-right": { online: "-right-0.5 -top-0.5", live: "-right-1 -top-1" },
  "bottom-right": { online: "-bottom-1 -right-1", live: "-bottom-1 -right-1" },
} as const;

/** The colored ring itself - offline/online/live are fixed tokens, independent of the
 * viewer's own account-type theme, so a ring means the same thing on every page. The
 * ring hugs its child with zero gap (no internal padding) so it reads as the avatar's
 * own frame rather than a halo floating around it. */
export function PresenceRing({
  status,
  size = "h-12 w-12",
  indicatorPosition = "top-right",
  indicatorSize = "h-3.5 w-3.5",
  liveIndicatorSize = "h-5 w-5",
  showIndicator = true,
  className,
  children,
}: {
  status: PresenceStatus;
  size?: string;
  /** Bottom-right is the conventional spot for a presence dot - default stays
   * top-right so existing small-avatar call sites (post cards, comment lists, the
   * live ring row) render unchanged. */
  indicatorPosition?: "top-right" | "bottom-right";
  indicatorSize?: string;
  liveIndicatorSize?: string;
  /** The ring's own color already communicates status - set false to skip the
   * separate dot/badge entirely (e.g. a large avatar where a small floating dot
   * reads as redundant clutter rather than useful signal). */
  showIndicator?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const position = INDICATOR_POSITION[indicatorPosition];

  return (
    <div
      data-presence-status={status}
      className={cn("relative shrink-0 rounded-full ring-2", size, RING_CLASS[status], className)}
    >
      {children}
      {showIndicator && status === "live" && (
        <span
          data-presence-indicator="live"
          className={cn(
            "absolute z-10 flex items-center justify-center rounded-full bg-presence-live text-white ring-2 ring-card",
            position.live,
            liveIndicatorSize,
          )}
          aria-hidden="true"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-presence-live/45 motion-reduce:animate-none" />
          <Radio className="relative h-[60%] w-[60%]" strokeWidth={2.5} />
        </span>
      )}
      {showIndicator && status === "online" && (
        <span
          data-presence-indicator="online"
          className={cn(
            "absolute z-10 rounded-full border-2 border-card bg-presence-online shadow-sm",
            position.online,
            indicatorSize,
          )}
          aria-hidden="true"
        />
      )}
      <span className="sr-only">
        {status === "live" ? "Live now" : status === "online" ? "Online" : "Offline"}
      </span>
    </div>
  );
}

/** A ring-wrapped avatar that links to the profile when offline/online, or to the live
 * stream when the person is live - clicking a live ring should take you to attend it. */
export function PresenceAvatarLink({
  href,
  status,
  avatarUrl,
  displayName,
  size = "h-12 w-12",
  fallbackClassName,
  showLiveBadge = true,
  goLiveBadge = false,
  className,
}: {
  href: string;
  status: PresenceStatus;
  avatarUrl: string;
  displayName: string;
  size?: string;
  fallbackClassName?: string;
  showLiveBadge?: boolean;
  goLiveBadge?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("relative block shrink-0", size, className)} aria-label={displayName}>
      <PresenceRing status={status} size={size}>
        <Avatar className="h-full w-full">
          <AvatarImage src={avatarUrl} alt="" />
          <AvatarFallback className={cn("text-xs font-semibold", fallbackClassName)}>
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </PresenceRing>
      {status === "live" && showLiveBadge && (
        <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-destructive px-1 py-px text-[7px] font-bold uppercase text-destructive-foreground">
          <Radio className="h-2 w-2" aria-hidden="true" />
          Live
        </span>
      )}
      {goLiveBadge && status !== "live" && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
          <Video className="h-2.5 w-2.5" aria-hidden="true" />
        </span>
      )}
    </Link>
  );
}
