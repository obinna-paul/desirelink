"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ShareProfileButton({
  profileHref,
  displayName,
  size = "default",
  className,
}: {
  profileHref: string;
  displayName: string;
  size?: "default" | "sm";
  className?: string;
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
      variant="outline"
      size={size}
      className={cn("h-11 flex-1 gap-1.5 sm:flex-none", className)}
      onClick={handleShare}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" /> Link copied
        </>
      ) : (
        "Share profile"
      )}
    </Button>
  );
}
