"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import { GIFT_PRESETS } from "@/lib/hearts-shared";

export type SendGiftOutcome = { ok: true; heartsBalance: number } | { ok: false; error: string };

/**
 * Reusable heart-gift sender — used during a live stream, on a provider's
 * profile, and from a chat thread. The caller owns the actual API call
 * (each context posts to a different endpoint) via `onSend`.
 */
export function GiftPicker({
  initialBalance,
  onSend,
  theme = "light",
}: {
  initialBalance: number;
  onSend: (hearts: number) => Promise<SendGiftOutcome>;
  theme?: "light" | "dark";
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<number | null>(null);

  async function handleSend(hearts: number) {
    setSending(hearts);
    setError(null);
    const result = await onSend(hearts);
    setSending(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBalance(result.heartsBalance);
  }

  const isDark = theme === "dark";

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className={cn("text-xs", isDark ? "text-red-300" : "text-destructive")}>
          {error}{" "}
          <Link href="/wallet" className="underline">
            Buy hearts
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {GIFT_PRESETS.map((hearts) => (
          <button
            key={hearts}
            type="button"
            disabled={sending !== null}
            onClick={() => handleSend(hearts)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
              isDark
                ? "border-white/20 text-white hover:bg-white/10"
                : "border-border/60 text-foreground hover:border-primary hover:bg-secondary"
            )}
          >
            <Heart className="h-3.5 w-3.5 text-neon-pink" aria-hidden="true" fill="currentColor" />
            {sending === hearts ? "…" : hearts}
          </button>
        ))}
        <span className={cn("shrink-0 text-xs", isDark ? "text-white/70" : "text-muted-foreground")}>
          {balance.toLocaleString()} hearts
        </span>
      </div>
    </div>
  );
}
