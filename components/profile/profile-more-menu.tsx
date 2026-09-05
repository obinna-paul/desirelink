"use client";

import { Ellipsis } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The "..." overflow menu shared by every branch of the profile action row (owner,
 * visiting a creator, visiting a regular profile) - a single shell so the trigger's size
 * and the dropdown's row styling can never drift between them the way three hand-copied
 * <details> blocks did before. Each caller supplies its own menu rows as children, styled
 * as a full-width icon+label row (see SignOutButton/ShareProfileButton/ReportDialog/
 * BlockButton's `menu` mode) rather than a stack of separate pill buttons.
 */
export function ProfileMoreMenu({ children }: { children: React.ReactNode }) {
  return (
    <details className="relative">
      <summary
        aria-label="More profile actions"
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "cursor-pointer list-none [&::-webkit-details-marker]:hidden"
        )}
      >
        <Ellipsis className="h-5 w-5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-12 z-30 flex min-w-48 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-lift">
        {children}
      </div>
    </details>
  );
}
