"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

import { HEART_PACKAGES } from "@/lib/hearts-shared";
import { formatCents } from "@/lib/creator";

export function BuyHeartsPanel() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packageId: string) {
    setPendingId(packageId);
    setError(null);
    const res = await fetch("/api/hearts/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setPendingId(null);
      setError(body?.error ?? "Couldn't start that purchase.");
      return;
    }

    if (body.state === "checkout") {
      window.location.href = body.checkoutUrl;
      return;
    }

    setPendingId(null);
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {HEART_PACKAGES.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            disabled={pendingId !== null}
            onClick={() => buy(pkg.id)}
            className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-4 text-center transition-colors hover:border-primary disabled:opacity-60"
          >
            <Heart className="h-5 w-5 text-primary" aria-hidden="true" fill="currentColor" />
            <span className="text-sm font-semibold">{pkg.hearts.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">{formatCents(pkg.priceCents)}</span>
          </button>
        ))}
      </div>
      {pendingId && <p className="text-xs text-muted-foreground">Starting checkout…</p>}
      <p className="text-xs text-muted-foreground">
        Hearts are non-refundable and spent by sending gifts to providers — on their profile, in chat, or during a
        live stream.
      </p>
    </div>
  );
}
