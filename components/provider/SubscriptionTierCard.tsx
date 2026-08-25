"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";
import type { PublicTierView } from "@/lib/tiers";

export function SubscriptionTierCard({ providerId, tier }: { providerId: string; tier: PublicTierView }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = tier.viewerState === "owner";
  const isSubscribed = tier.viewerState === "subscribed";
  const isPending = tier.viewerState === "pending";
  const isFull = tier.viewerState === "full";
  const spotsRemaining =
    tier.isLimited && tier.maxSubscribers ? Math.max(0, tier.maxSubscribers - tier.subscriberCount) : null;

  async function handleSubscribe() {
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
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    if (body?.state === "checkout" && body?.checkoutUrl) {
      router.push(body.checkoutUrl);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{tier.name}</p>
          <p className="text-lg font-bold text-primary">
            {formatCents(tier.priceCents)}
            <span className="text-xs font-normal text-muted-foreground">/mo</span>
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {tier.requiresApproval && (
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" aria-hidden="true" /> Application required
            </Badge>
          )}
          {spotsRemaining !== null && (
            <Badge variant="outline">
              {spotsRemaining > 0 ? `${spotsRemaining} spots remaining` : "Full"}
            </Badge>
          )}
        </div>
      </div>

      {tier.description && <p className="text-sm text-muted-foreground">{tier.description}</p>}

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3 w-3" aria-hidden="true" />
        {tier.subscriberCount} subscriber{tier.subscriberCount === 1 ? "" : "s"}
      </p>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {isOwner ? null : isSubscribed ? (
        <Badge variant="neon" className="w-fit gap-1">
          <Check className="h-3 w-3" aria-hidden="true" /> Subscribed
        </Badge>
      ) : isPending ? (
        <Badge variant="outline" className="w-fit">
          Application pending
        </Badge>
      ) : (
        <Button type="button" onClick={handleSubscribe} disabled={pending || isFull}>
          {pending ? "..." : isFull ? "Full" : tier.requiresApproval ? "Apply" : "Subscribe"}
        </Button>
      )}
    </div>
  );
}
