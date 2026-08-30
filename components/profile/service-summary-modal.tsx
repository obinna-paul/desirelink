"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { ServiceListingSummaryCard } from "@/components/provider/ServiceListingMenu";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { ServiceListingView } from "@/lib/service-listings";

export function ServiceSummaryModal({
  listing,
  providerUsername,
  isOwner,
  onClose,
}: {
  listing: ServiceListingView;
  providerUsername: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, dialogRef);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Service: ${listing.title}`}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-18px_45px_rgba(15,10,18,0.18)] focus:outline-none sm:rounded-2xl sm:p-5 sm:shadow-2xl"
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <ServiceListingSummaryCard listing={listing} providerUsername={providerUsername} isOwner={isOwner} />
      </div>
    </div>
  );
}
