"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicTierView } from "@/lib/tiers";

export function ProfileSubscribeButton({
  providerId,
  subscription,
  size = "default",
  className,
}: {
  providerId: string;
  subscription: PublicTierView;
  size?: "default" | "sm";
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscribed = subscription.viewerState === "subscribed";

  async function subscribe() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/providers/${providerId}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId: subscription.id }),
    });
    const body = await response.json().catch(() => null);
    setPending(false);

    if (!response.ok) {
      setError(body?.error ?? "We couldn't start your subscription.");
      return;
    }
    if (body?.state === "checkout" && body.checkoutUrl) {
      router.push(body.checkoutUrl);
      return;
    }
    router.refresh();
  }

  return (
    <div className="min-w-0">
      <Button
        type="button"
        variant={subscribed ? "outline" : "default"}
        size={size}
        className={cn("h-10 min-w-28", className)}
        disabled={pending || subscribed || subscription.viewerState === "pending" || subscription.viewerState === "full"}
        onClick={subscribe}
      >
        {subscribed && <Check className="h-4 w-4" aria-hidden="true" />}
        {subscribed
          ? "Subscribed"
          : subscription.viewerState === "pending"
            ? "Pending"
            : subscription.viewerState === "full"
              ? "Unavailable"
              : pending
                ? "Please wait"
                : "Subscribe"}
      </Button>
      {error && <p role="alert" className="mt-1 max-w-48 text-xs text-destructive">{error}</p>}
    </div>
  );
}
