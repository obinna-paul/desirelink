"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PremiumUpsell } from "@/components/premium/premium-upsell";
import type { MembershipState } from "@/lib/rooms";

export function JoinButton({
  roomId,
  initialState,
  isPrivate,
}: {
  roomId: string;
  initialState: MembershipState;
  isPrivate: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumUpsell, setPremiumUpsell] = useState<string | null>(null);

  async function handleJoin() {
    setPending(true);
    setError(null);
    setPremiumUpsell(null);

    const res = await fetch(`/api/rooms/${roomId}/join`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      if (body?.code === "PREMIUM_REQUIRED") {
        setPremiumUpsell(body.error);
      } else {
        setError(body?.error ?? "Couldn't join this room. Try again.");
      }
      return;
    }

    setState(body.state === "pending" ? "pending" : "member");
    router.refresh();
  }

  if (state === "admin") {
    return (
      <Button variant="outline" disabled className="gap-1.5">
        <Sparkles className="h-4 w-4" aria-hidden="true" /> Admin
      </Button>
    );
  }

  if (state === "member") {
    return (
      <Button variant="outline" disabled className="gap-1.5">
        <Check className="h-4 w-4" aria-hidden="true" /> Member
      </Button>
    );
  }

  if (state === "pending") {
    return (
      <Button variant="outline" disabled className="gap-1.5">
        <Clock className="h-4 w-4" aria-hidden="true" /> Request pending
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button type="button" onClick={handleJoin} disabled={pending}>
        {pending ? "..." : isPrivate ? "Request to join" : "Join"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {premiumUpsell && (
        <div className="max-w-sm">
          <PremiumUpsell
            compact
            title="Room limit reached"
            description={premiumUpsell}
          />
        </div>
      )}
    </div>
  );
}
