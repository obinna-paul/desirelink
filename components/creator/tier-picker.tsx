"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, LockKeyhole, X } from "lucide-react";

import { TierPrice } from "@/components/subscriptions/tier-price";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

type TierOption = {
  id: string;
  name: string;
  priceCents: number;
  compareAtPriceCents: number | null;
};

export function TierPicker({
  tiers,
  value,
  onChange,
}: {
  tiers: readonly TierOption[];
  value: string | null;
  onChange: (tierId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fieldLabelId = useId();
  const dialogTitleId = useId();
  const listboxId = useId();
  const selectedTier = tiers.find((tier) => tier.id === value) ?? null;

  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const picker = open && typeof document !== "undefined"
    ? createPortal(
        <div className="fixed inset-0 z-[120] flex items-end justify-center md:items-center md:p-6">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close tier picker"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            tabIndex={-1}
            className="relative z-[1] flex max-h-[min(78dvh,38rem)] w-full flex-col overflow-hidden rounded-t-[20px] border border-border bg-card text-foreground shadow-2xl outline-none motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 md:max-w-md md:rounded-lg md:motion-safe:zoom-in-95"
          >
            <div className="flex justify-center pb-1 pt-2.5 md:hidden" aria-hidden="true">
              <span className="h-1 w-9 rounded-full bg-border" />
            </div>

            <header className="flex items-start gap-3 border-b border-border px-4 pb-4 pt-3 md:px-5 md:pt-5">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-tint text-primary">
                <LockKeyhole className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={dialogTitleId} className="text-base font-bold text-foreground">
                  Choose an access tier
                </h2>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  Subscribers to this tier or higher can view the post.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close tier picker"
                className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div
              id={listboxId}
              role="listbox"
              aria-label="Subscription tiers"
              className="min-h-0 overflow-y-auto p-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:p-3"
            >
              {tiers.map((tier) => {
                const selected = tier.id === value;

                return (
                  <button
                    key={tier.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(tier.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "group flex min-h-[68px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      selected
                        ? "bg-accent-tint text-foreground"
                        : "text-foreground hover:bg-accent/70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/45 bg-background group-hover:border-muted-foreground",
                      )}
                      aria-hidden="true"
                    >
                      {selected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{tier.name}</span>
                      <TierPrice
                        priceCents={tier.priceCents}
                        compareAtPriceCents={tier.compareAtPriceCents}
                        className="mt-1"
                        currentClassName="text-foreground"
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={fieldLabelId} className="text-xs font-medium text-muted-foreground">
        Which tier unlocks this post?
      </span>
      <button
        type="button"
        role="combobox"
        aria-labelledby={fieldLabelId}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-input bg-background px-3.5 py-2.5 text-left transition-[border-color,background-color,box-shadow] hover:border-foreground/30 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-tint text-primary">
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-semibold", !selectedTier && "text-muted-foreground")}>
            {selectedTier?.name ?? "Choose a tier"}
          </span>
          {selectedTier && (
            <TierPrice
              priceCents={selectedTier.priceCents}
              compareAtPriceCents={selectedTier.compareAtPriceCents}
              className="mt-0.5"
              currentClassName="text-xs text-foreground"
            />
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {picker}
    </div>
  );
}
