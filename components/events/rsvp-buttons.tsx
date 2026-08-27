"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, HelpCircle, X } from "lucide-react";

import { PremiumUpsell } from "@/components/premium/premium-upsell";
import { cn } from "@/lib/utils";
import type { RsvpAction } from "@/lib/rsvp";

const OPTIONS: { value: RsvpAction; label: string; icon: typeof Check }[] = [
  { value: "going", label: "Going", icon: Check },
  { value: "interested", label: "Interested", icon: HelpCircle },
  { value: "not_going", label: "Cannot Go", icon: X },
];

export function RsvpButtons({
  eventId,
  initialStatus,
  isPriced,
}: {
  eventId: string;
  initialStatus: RsvpAction | null;
  isPriced: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<RsvpAction | null>(initialStatus);
  const [pending, setPending] = useState<RsvpAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [premiumUpsell, setPremiumUpsell] = useState<string | null>(null);

  async function handleClick(action: RsvpAction) {
    if (pending) return;
    setPending(action);
    setError(null);
    setNotice(null);
    setPremiumUpsell(null);

    const res = await fetch(`/api/events/${eventId}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setPending(null);
      setError(body?.error ?? "Couldn't update your RSVP. Try again.");
      return;
    }

    if (body.state === "checkout" && body.checkoutUrl) {
      router.push(body.checkoutUrl);
      return;
    }

    setPending(null);
    setStatus(body.status === "waitlist" ? null : action);
    if (body.message) setNotice(body.message);
    if (body.status === "waitlist" && body.message?.includes("Premium")) {
      setPremiumUpsell(body.message);
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="RSVP to this event">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const pressed = status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={pressed}
              disabled={pending !== null}
              onClick={() => handleClick(option.value)}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-60",
                pressed
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border/60 bg-card text-muted-foreground hover:border-neon-pink/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {pending === option.value
                ? "Saving..."
                : option.value === "going" && isPriced && status !== "going"
                  ? "Going (pay to confirm)"
                  : option.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      {premiumUpsell && (
        <PremiumUpsell
          compact
          title="Premium RSVP priority"
          description={premiumUpsell}
        />
      )}
    </div>
  );
}
