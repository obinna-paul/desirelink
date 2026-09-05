"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/creator";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { TIER_TYPE_LABELS } from "@/lib/validations/creator-tier";
import type { PublicTierView } from "@/lib/tiers";

function tierButtonState(tier: PublicTierView): { label: string; disabled: boolean } {
  switch (tier.viewerState) {
    case "subscribed":
      return { label: "Subscribed", disabled: true };
    case "full":
      return { label: "Unavailable", disabled: true };
    default:
      return { label: "Subscribe", disabled: false };
  }
}

export function SubscribePlansDialog({
  providerId,
  tiers,
  size = "default",
  className,
  renderTrigger,
  conversionPostId,
}: {
  providerId: string;
  tiers: PublicTierView[];
  size?: "default" | "sm";
  className?: string;
  /** Lets a caller in a different visual context (e.g. a feed chip, vs. the profile
   * page's own action row) render its own trigger while reusing this exact modal/
   * interaction, instead of the default full-width Button below. */
  renderTrigger?: (props: { onClick: () => void; currentTier: PublicTierView | null }) => React.ReactNode;
  /** The specific locked post whose "Subscribe now" button opened this dialog, if any -
   * grants permanent access to that one post once payment succeeds, regardless of which
   * tier is actually bought. See PostUnlock. */
  conversionPostId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingTierId, setPendingTierId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function subscribeToTier(tier: PublicTierView) {
    setPendingTierId(tier.id);
    setError(null);

    const response = await fetch(`/api/providers/${providerId}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId: tier.id, conversionPostId }),
    });
    const body = await response.json().catch(() => null);
    setPendingTierId(null);

    if (!response.ok) {
      setError(body?.error ?? "We couldn't start your subscription.");
      return;
    }
    if (body?.state === "checkout" && body.checkoutUrl) {
      router.push(body.checkoutUrl);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  const currentTier = tiers.find((tier) => tier.viewerState === "subscribed") ?? null;

  return (
    <div className={cn("min-w-0", className)}>
      {renderTrigger ? (
        renderTrigger({ onClick: () => setOpen(true), currentTier })
      ) : (
        <Button
          type="button"
          variant={currentTier ? "outline" : "default"}
          size={size}
          className="h-10 w-full min-w-28"
          onClick={() => setOpen(true)}
        >
          {currentTier && <Check className="h-4 w-4" aria-hidden="true" />}
          {currentTier ? `Subscribed · ${currentTier.name}` : "Subscribe"}
        </Button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscribe-plans-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl border border-border/60 bg-card p-5 shadow-xl focus:outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="subscribe-plans-title" className="text-sm font-semibold">
                Choose a plan
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {error && (
              <p role="alert" className="mb-3 text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 overflow-y-auto">
              {tiers.map((tier) => {
                const state = tierButtonState(tier);
                const tierTypeLabel =
                  TIER_TYPE_LABELS[tier.tierType as keyof typeof TIER_TYPE_LABELS] ?? tier.tierType;

                return (
                  <div key={tier.id} className="rounded-xl border border-border/60 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{tier.name}</p>
                        <p className="text-xs text-muted-foreground">{tierTypeLabel}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-primary">
                        {formatCents(tier.priceCents)}/mo
                      </p>
                    </div>
                    {tier.description && (
                      <p className="mt-1.5 text-xs text-muted-foreground">{tier.description}</p>
                    )}
                    {tier.isLimited && tier.maxSubscribers && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {tier.subscriberCount}/{tier.maxSubscribers} spots filled
                      </p>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={tier.viewerState === "subscribed" ? "outline" : "default"}
                      className="mt-2.5 w-full gap-1.5"
                      disabled={state.disabled || pendingTierId !== null}
                      onClick={() => subscribeToTier(tier)}
                    >
                      {tier.viewerState === "subscribed" && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      {pendingTierId === tier.id ? "Please wait..." : state.label}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
