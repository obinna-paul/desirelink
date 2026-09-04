"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";
import type { MySubscriptionRow } from "@/lib/subscription-access";

const STATUS_VARIANT = {
  active: "neon",
  cancelled: "secondary",
  expired: "outline",
} as const;

function SubscriptionRow({
  subscription,
  onCancel,
  cancelling,
}: {
  subscription: MySubscriptionRow;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const initials = subscription.creator.displayName.slice(0, 2).toUpperCase();
  const isPendingCancel = subscription.status === "active" && subscription.cancelAtPeriodEnd;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between md:rounded-lg md:shadow-none">
      <Link href={`/profile/${subscription.creator.username}`} className="flex min-w-0 items-center gap-3">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={subscription.creator.avatarUrl} alt={subscription.creator.displayName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{subscription.creator.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {subscription.tier.name} &middot; {formatCents(subscription.tier.priceCents)}/mo
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="text-left sm:text-right">
          <Badge variant={isPendingCancel ? "secondary" : STATUS_VARIANT[subscription.status]} className="capitalize">
            {isPendingCancel ? "Cancelled" : subscription.status}
          </Badge>
          <p className="mt-1 text-xs text-muted-foreground">
            {subscription.status === "active" ? (isPendingCancel ? "Access ends " : "Ends ") : "Ended "}
            {new Date(subscription.endsAt).toLocaleDateString()}
          </p>
        </div>
        {onCancel && !isPendingCancel && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full text-destructive sm:w-auto"
            disabled={cancelling}
            onClick={onCancel}
          >
            {cancelling ? "Cancelling..." : "Cancel"}
          </Button>
        )}
      </div>
    </li>
  );
}

export function SubscriptionsList({ initialSubscriptions }: { initialSubscriptions: MySubscriptionRow[] }) {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel(id: string) {
    setCancellingId(id);
    setError(null);

    const res = await fetch(`/api/subscriptions/${id}/cancel`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setCancellingId(null);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't cancel your subscription. Please try again.");
      return;
    }

    setSubscriptions((prev) =>
      prev.map((sub) => (sub.id === id ? { ...sub, cancelAtPeriodEnd: true } : sub))
    );
    router.refresh();
  }

  const active = subscriptions.filter((sub) => sub.status === "active");
  const past = subscriptions.filter((sub) => sub.status !== "active");

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
          Active subscriptions
        </h2>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
            You&apos;re not subscribed to any creators yet.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((subscription) => (
              <SubscriptionRow
                key={subscription.id}
                subscription={subscription}
                onCancel={() => handleCancel(subscription.id)}
                cancelling={cancellingId === subscription.id}
              />
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">
            Past subscriptions
          </h2>
          <ul className="flex flex-col gap-3">
            {past.map((subscription) => (
              <SubscriptionRow key={subscription.id} subscription={subscription} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
