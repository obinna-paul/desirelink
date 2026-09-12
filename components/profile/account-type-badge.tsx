"use client";

import { useEffect, useRef, useState } from "react";
import type { ProfileType } from "@prisma/client";
import { Compass, Crown, Heart, type LucideIcon } from "lucide-react";

const ACCOUNT_TYPE_BADGE: Record<ProfileType, { icon: LucideIcon; label: string; colorClass: string }> = {
  CREATOR: { icon: Crown, label: "Creator", colorClass: "text-account-creator" },
  EXPLORER: { icon: Compass, label: "Explorer", colorClass: "text-account-explorer" },
  SEEKER: { icon: Heart, label: "Seeker", colorClass: "text-account-seeker" },
};

/** A small, always-on icon (crown/compass/heart) identifying a profile's account type -
 * shown inline next to the name, same slot as VerificationBadge. Unlike that badge, this
 * one is never hidden: every profile has exactly one account type, and letting people
 * tell at a glance who's a Creator/Explorer/Seeker is useful given what those mean here. */
export function AccountTypeBadge({ profileType }: { profileType: ProfileType }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const { icon: Icon, label, colorClass } = ACCOUNT_TYPE_BADGE[profileType];

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`${label} account`}
        className={`flex h-5 w-5 items-center justify-center ${colorClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-2 whitespace-nowrap rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-lg">
          {label}
        </div>
      )}
    </span>
  );
}
