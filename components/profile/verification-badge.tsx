"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";

export type VerificationBadgeProfile = {
  isVerified: boolean;
  isVerifiedCreator: boolean;
  isVerifiedServiceProvider: boolean;
  verificationPending: boolean;
  isTrustedMember?: boolean;
};

export function VerificationBadge({ profile }: { profile: VerificationBadgeProfile }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const isVerifiedProvider =
    profile.isVerified ||
    profile.isVerifiedCreator ||
    profile.isVerifiedServiceProvider;

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

  if (isVerifiedProvider) {
    const badges = ["Verified creator", profile.isTrustedMember && "Trusted member"].filter(Boolean) as string[];

    return (
      <span ref={containerRef} className="relative inline-flex shrink-0 align-middle">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="Show verification details"
          className="flex h-5 w-5 items-center justify-center text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <BadgeCheck className="h-5 w-5 fill-primary text-primary-foreground" aria-hidden="true" />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-10 mt-2 w-64 rounded-xl border border-border/70 bg-card p-3 shadow-lg">
            <ul className="flex flex-col gap-1.5">
              {badges.map((label) => (
                <li
                  key={label}
                  className="flex items-center gap-2 text-xs font-medium text-foreground"
                >
                  <ShieldCheck
                    className="h-3.5 w-3.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />{" "}
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </span>
    );
  }

  if (profile.verificationPending) {
    return (
      <BadgeCheck
        className="inline-block h-5 w-5 shrink-0 align-middle text-muted-foreground"
        aria-label="Verification pending review"
      />
    );
  }

  return null;
}
