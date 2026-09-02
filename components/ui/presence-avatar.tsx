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

/** The colored ring itself - offline/online/live are fixed tokens, independent of the
 * viewer's own account-type theme, so a ring means the same thing on every page. */
export function PresenceRing({
  status,
  size = "h-12 w-12",
  className,
  children,
}: {
  status: PresenceStatus;
  size?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative shrink-0 rounded-full p-[2px] ring-2", size, RING_CLASS[status], className)}>
      {children}
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
