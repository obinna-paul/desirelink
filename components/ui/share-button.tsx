"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Generic share affordance for any canonical, publicly-linkable page (events, services, posts). */
export function ShareButton({
  href,
  title,
  label = "Share",
  variant = "outline",
  size = "sm",
  className,
}: {
  href: string;
  title: string;
  label?: string;
  variant?: "outline" | "ghost" | "default";
  size?: "default" | "sm" | "icon";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = typeof window !== "undefined" ? new URL(href, window.location.origin).toString() : href;
    const canShare = typeof navigator !== "undefined" && "share" in navigator;

    if (canShare) {
      await navigator.share({ title, url }).catch(() => null);
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
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
      onClick={handleShare}
      aria-label={size === "icon" ? (copied ? "Link copied" : label) : undefined}
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Share2 className="h-4 w-4" aria-hidden="true" />
      )}
      {size !== "icon" && (copied ? "Link copied" : label)}
    </Button>
  );
}
