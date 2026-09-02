"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Heart, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/creator";
import { GIFT_PRESETS, HEART_UNIT_PRICE_CENTS } from "@/lib/hearts-shared";

export type SendGiftOutcome = { ok: true; heartsBalance: number } | { ok: false; error: string };

/** Presets at or below this send on a single tap; larger and custom amounts need a confirming second tap first — each heart is ₦1,000, so a stray tap on "500" would move real money. */
const INSTANT_MAX = 10;
const ARM_TIMEOUT_MS = 4000;
const SUCCESS_FLASH_MS = 2200;

/**
 * Reusable heart-gift sender — used during a live stream and from a chat
 * thread. The caller owns the actual API call (each context posts to a
 * different endpoint) via `onSend`.
 */
export function GiftPicker({
  initialBalance,
  onSend,
  theme = "light",
  showBalance = true,
}: {
  initialBalance: number;
  onSend: (hearts: number) => Promise<SendGiftOutcome>;
  theme?: "light" | "dark";
  showBalance?: boolean;
}) {
  const isDark = theme === "dark";
  const [balance, setBalance] = useState(initialBalance);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [justSent, setJustSent] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState("");
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  function arm(hearts: number) {
    setError(null);
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmed(hearts);
    armTimer.current = setTimeout(() => setArmed(null), ARM_TIMEOUT_MS);
  }

  async function commit(hearts: number) {
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmed(null);
    setSending(hearts);
    setError(null);
    const result = await onSend(hearts);
    setSending(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBalance(result.heartsBalance);
    setCustomValue("");
    setJustSent(hearts);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setJustSent(null), SUCCESS_FLASH_MS);
  }

  function tapAmount(hearts: number) {
    if (sending !== null) return;
    if (hearts <= INSTANT_MAX) {
      void commit(hearts);
      return;
    }
    if (armed === hearts) {
      void commit(hearts);
      return;
    }
    arm(hearts);
  }

  const customHearts = Math.trunc(Number(customValue));
  const customEntered = customValue.trim() !== "" && Number.isFinite(customHearts) && customHearts > 0;
  const customAffordable = customEntered && customHearts <= balance;

  const statusNode = error ? (
    <span role="alert" className={cn(isDark ? "text-red-300" : "text-destructive")}>
      {error}{" "}
      <Link href="/wallet" className="underline">
        Buy hearts
      </Link>
    </span>
  ) : justSent ? (
    <span className={cn("inline-flex items-center gap-1 font-medium", isDark ? "text-emerald-300" : "text-emerald-600")}>
      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Sent {justSent.toLocaleString()} hearts
    </span>
  ) : armed ? (
    <span className={isDark ? "text-white/70" : "text-muted-foreground"}>
      Tap again to send {armed.toLocaleString()} hearts ({formatCents(armed * HEART_UNIT_PRICE_CENTS)})
    </span>
  ) : customEntered && !customAffordable ? (
    <span className={isDark ? "text-white/70" : "text-muted-foreground"}>
      You need {(customHearts - balance).toLocaleString()} more hearts for that amount
    </span>
  ) : null;

  return (
    <div className="flex flex-col gap-2.5">
      {showBalance && (
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              isDark ? "border-white/15 bg-white/5 text-white" : "border-border/60 bg-secondary text-foreground"
            )}
          >
            <Heart className="h-3.5 w-3.5 text-neon-pink" aria-hidden="true" fill="currentColor" />
            {balance.toLocaleString()} hearts
          </span>
          <Link
            href="/wallet"
            className={cn("text-xs font-medium underline-offset-2 hover:underline", isDark ? "text-white/70" : "text-primary")}
          >
            Buy hearts
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Gift amount">
        {GIFT_PRESETS.map((hearts) => {
          const affordable = balance >= hearts;
          const isArmed = armed === hearts;
          const isSending = sending === hearts;
          const isSent = justSent === hearts;
          return (
            <button
              key={hearts}
              type="button"
              disabled={!affordable || sending !== null}
              aria-pressed={isArmed}
              onClick={() => tapAmount(hearts)}
              title={!affordable ? `You need ${(hearts - balance).toLocaleString()} more hearts` : undefined}
              className={cn(
                "flex min-h-11 min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                isDark
                  ? isArmed
                    ? "border-neon-pink bg-neon-pink/15"
                    : "border-white/15 hover:bg-white/10"
                  : isArmed
                    ? "border-primary bg-accent-tint"
                    : "border-border/60 hover:border-primary/60 hover:bg-secondary"
              )}
            >
              <span className={cn("flex items-center gap-1 text-sm font-semibold", isDark ? "text-white" : "text-foreground")}>
                {isSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : isSent ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Heart className="h-3.5 w-3.5 text-neon-pink" aria-hidden="true" fill="currentColor" />
                )}
                {hearts.toLocaleString()}
              </span>
              <span className={cn("text-[10px] font-medium", isDark ? "text-white/50" : "text-muted-foreground")}>
                {isArmed ? "Tap again" : formatCents(hearts * HEART_UNIT_PRICE_CENTS)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder="Custom amount"
          aria-label="Custom hearts amount"
          disabled={sending !== null}
          className={cn(
            "h-11 w-32 min-w-0 rounded-full border px-3.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40",
            isDark
              ? "border-white/15 bg-white/5 text-white placeholder:text-white/40"
              : "border-border/60 bg-background text-foreground placeholder:text-muted-foreground"
          )}
        />
        <button
          type="button"
          disabled={!customAffordable || sending !== null}
          aria-pressed={customEntered && armed === customHearts}
          onClick={() => customEntered && tapAmount(customHearts)}
          className={cn(
            "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            isDark
              ? customEntered && armed === customHearts
                ? "border-neon-pink bg-neon-pink/15 text-white"
                : "border-white/15 text-white hover:bg-white/10"
              : customEntered && armed === customHearts
                ? "border-primary bg-accent-tint text-primary"
                : "border-border/60 text-foreground hover:border-primary/60 hover:bg-secondary"
          )}
        >
          {sending !== null && sending === customHearts ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Heart className="h-3.5 w-3.5 text-neon-pink" aria-hidden="true" fill="currentColor" />
          )}
          {customEntered && armed === customHearts ? "Tap again" : "Send"}
        </button>
      </div>

      <p role="status" aria-live="polite" className="min-h-[1rem] text-xs">
        {statusNode}
      </p>
    </div>
  );
}
