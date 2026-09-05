"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

import { formatCents } from "@/lib/creator";
import { SubscribePlansDialog } from "@/components/profile/subscribe-plans-dialog";
import type { PostSubscribePrompt } from "@/lib/posts";

const CHIP_CLASSNAME =
  "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-60 disabled:active:scale-100";

/**
 * The lead-magnet pitch on a free post: one tier to subscribe to directly, or the full
 * plan picker (same slide-up dialog as the profile page's own Subscribe button, opened
 * inline - never a navigation away from the feed) when the creator has more than one.
 * Mirrors components/live/subscribe-chip.tsx's logic, styled for a card background
 * instead of a dark video overlay.
 */
export function PostSubscribeChip({ prompt }: { prompt: PostSubscribePrompt }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  if (subscribed) return null;

  const singleTier = prompt.tiers.length === 1 ? prompt.tiers[0] : null;

  async function subscribeToTier(tierId: string) {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/providers/${prompt.providerId}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId }),
    });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't subscribe.");
      return;
    }
    if (body?.state === "checkout" && body.checkoutUrl) {
      window.location.href = body.checkoutUrl;
      return;
    }
    setSubscribed(true);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {error && <p className="text-xs text-destructive">{error}</p>}
      {singleTier ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => subscribeToTier(singleTier.id)}
          className={CHIP_CLASSNAME}
        >
          <Heart className="h-3.5 w-3.5" aria-hidden="true" fill="currentColor" />
          {pending ? "…" : `Subscribe · ${formatCents(singleTier.priceCents)}/mo`}
        </button>
      ) : (
        <SubscribePlansDialog
          providerId={prompt.providerId}
          tiers={prompt.tiers}
          renderTrigger={({ onClick }) => (
            <button type="button" onClick={onClick} className={CHIP_CLASSNAME}>
              <Heart className="h-3.5 w-3.5" aria-hidden="true" fill="currentColor" />
              Subscribe
            </button>
          )}
        />
      )}
    </div>
  );
}
