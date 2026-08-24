"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";
import type { PublicTierView, TierViewerState } from "@/lib/tiers";

function StatusBadge({ state }: { state: TierViewerState }) {
  switch (state) {
    case "subscribed":
      return <Badge variant="neon">Subscribed</Badge>;
    case "pending":
      return (
        <Badge variant="outline" className="gap-1">
          <Lock className="h-3 w-3" aria-hidden="true" /> Application pending
        </Badge>
      );
    case "full":
      return <Badge variant="secondary">Tier full</Badge>;
    default:
      return null;
  }
}

export function TierSubscribeCard({ tier }: { tier: PublicTierView }) {
  const router = useRouter();
  const [state, setState] = useState<TierViewerState>(tier.viewerState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string) {
    setPending(true);
    setError(null);

    const res = await fetch(path, { method: "POST" });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setPending(false);
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    if (body.state === "checkout" && body.checkoutUrl) {
      router.push(body.checkoutUrl);
      return;
    }

    setPending(false);
    setState(body.state as TierViewerState);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{tier.name}</h3>
            {tier.requiresApproval && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden="true" /> Application required
              </Badge>
            )}
          </div>
          {tier.description && (
            <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
          )}
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" aria-hidden="true" />
            {tier.subscriberCount}
            {tier.maxSubscribers ? ` / ${tier.maxSubscribers}` : ""} members
          </p>
        </div>
        <p className="shrink-0 text-lg font-semibold text-neon-cyan">
          {formatCents(tier.priceCents)}
          <span className="text-xs font-normal text-muted-foreground">/mo</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {state === "owner" ? null : state === "available" ? (
          <Button type="button" size="sm" disabled={pending} onClick={() => call(`/api/tiers/${tier.id}/subscribe`)}>
            {pending ? "Please wait..." : tier.requiresApproval ? "Apply" : "Subscribe"}
          </Button>
        ) : state === "denied" ? (
          <>
            <Badge variant="secondary">Application denied</Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => call(`/api/tiers/${tier.id}/subscribe`)}
            >
              {pending ? "Please wait..." : "Apply again"}
            </Button>
          </>
        ) : state === "approved" ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => call(`/api/tiers/${tier.id}/complete-payment`)}
          >
            {pending ? "Processing..." : "Complete payment (mock)"}
          </Button>
        ) : (
          <StatusBadge state={state} />
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
