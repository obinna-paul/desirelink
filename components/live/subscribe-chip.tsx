"use client";

import { useState } from "react";
import Link from "next/link";

import { formatCents } from "@/lib/creator";
import type { PublicTierView } from "@/lib/tiers";

/** Shown on a live stream's host chip so a viewer can subscribe without hunting for the profile page. */
export function SubscribeChip({
  providerId,
  providerUsername,
  tiers,
}: {
  providerId: string;
  providerUsername: string;
  tiers: PublicTierView[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  const available = tiers.filter((tier) => tier.viewerState === "available");
  if (subscribed || available.length === 0) return null;

  const singleTier = available.length === 1 ? available[0] : null;

  async function subscribeToTier(tier: PublicTierView) {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/providers/${providerId}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId: tier.id }),
    });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't subscribe.");
      return;
    }
    if (body.state === "checkout") {
      window.location.href = body.checkoutUrl;
      return;
    }
    setSubscribed(true);
  }

  if (singleTier && !singleTier.requiresApproval) {
    return (
      <div className="flex flex-col items-start gap-1">
        {error && <p className="text-[10px] text-red-300">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() => subscribeToTier(singleTier)}
          className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "…" : `Subscribe · ${formatCents(singleTier.priceCents)}/mo`}
        </button>
      </div>
    );
  }

  return (
    <Link
      href={`/profile/${providerUsername}`}
      className="w-fit rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/25"
    >
      View plans
    </Link>
  );
}
