"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `menu` renders this as a full-width labeled row (for a profile's "..." overflow menu)
 * instead of the standalone pill button used inline in the action row - same dual-mode
 * pattern as SignOutButton/ReportDialog/BlockButton. */
export function ShareProfileButton({
  profileHref,
  displayName,
  size = "default",
  className,
  menu = false,
}: {
  profileHref: string;
  displayName: string;
  size?: "default" | "sm";
  className?: string;
  menu?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = typeof window !== "undefined" ? new URL(profileHref, window.location.origin).toString() : profileHref;
    const canShare = typeof navigator !== "undefined" && "share" in navigator;

    if (canShare) {
      await navigator.share({ title: `${displayName} on udala`, url }).catch(() => null);
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Button
      type="button"
      variant={menu ? "ghost" : "outline"}
      size={menu ? "sm" : size}
      className={cn(
        menu
          ? "min-h-11 w-full justify-start gap-1.5 rounded-lg px-3 text-sm font-medium"
          : "h-11 flex-1 gap-1.5 sm:flex-none",
        className
      )}
      onClick={handleShare}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" /> Link copied
        </>
      ) : menu ? (
        <>
          <Share2 className="h-4 w-4" aria-hidden="true" /> Share profile
        </>
      ) : (
        "Share profile"
      )}
    </Button>
  );
}
