"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Radio, Share2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { LiveStreamProviderSummary } from "@/lib/live-streams";

const STATUS_POLL_MS = 15_000;

/**
 * Starts as null (rather than computing Date.now() in the initializer) so the very first
 * client render matches the server-rendered HTML exactly - computing it eagerly would use
 * two different "now"s (server render time vs. client hydration time) and trigger a
 * hydration mismatch. The real value only ever appears via this effect, client-side only.
 */
function useCountdown(targetIso: string) {
  const [msRemaining, setMsRemaining] = useState<number | null>(null);

  useEffect(() => {
    setMsRemaining(new Date(targetIso).getTime() - Date.now());
    const id = setInterval(() => setMsRemaining(new Date(targetIso).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return msRemaining;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      <span className="font-heading text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export function LiveScheduleCountdown({
  streamId,
  title,
  scheduledFor,
  provider,
  isLoggedIn,
}: {
  streamId: string;
  title: string;
  scheduledFor: string;
  provider: LiveStreamProviderSummary;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const msRemaining = useCountdown(scheduledFor);
  const [copied, setCopied] = useState(false);
  const initials = provider.displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch(`/api/live/${streamId}/status`).catch(() => null);
      if (!res?.ok) return;
      const body = await res.json().catch(() => null);
      if (body?.status && body.status !== "scheduled") {
        router.refresh();
      }
    }, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [router, streamId]);

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : `/live/${streamId}`;
    const canShare = typeof navigator !== "undefined" && "share" in navigator;

    if (canShare) {
      await navigator.share({ title: `${provider.displayName} is going live on udala`, url }).catch(() => null);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const totalSeconds = msRemaining === null ? null : Math.max(0, Math.floor(msRemaining / 1000));
  const days = totalSeconds === null ? 0 : Math.floor(totalSeconds / 86_400);
  const hours = totalSeconds === null ? 0 : Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = totalSeconds === null ? 0 : Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds === null ? 0 : totalSeconds % 60;
  const hasStarted = msRemaining !== null && msRemaining <= 0;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-10 text-center">
      <Avatar className="h-16 w-16 border border-border">
        <AvatarImage src={provider.avatarUrl} alt={provider.displayName} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div>
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          Scheduled live
        </p>
        <h1 className="mt-2 font-heading text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {provider.displayName} (@{provider.username})
        </p>
      </div>

      {hasStarted ? (
        <p className="text-sm text-muted-foreground">
          It&rsquo;s about time - checking if {provider.displayName} has started...
        </p>
      ) : (
        <div className="flex items-center gap-2 sm:gap-3">
          {days > 0 && <CountdownUnit value={days} label="Days" />}
          <CountdownUnit value={hours} label="Hours" />
          <CountdownUnit value={minutes} label="Min" />
          <CountdownUnit value={seconds} label="Sec" />
        </div>
      )}

      <div className="flex w-full flex-col gap-3">
        {!isLoggedIn && (
          <Button asChild className="w-full">
            <Link href={`/login?callbackUrl=${encodeURIComponent(`/live/${streamId}`)}`}>Log in to join when it starts</Link>
          </Button>
        )}
        <Button type="button" variant="outline" className="w-full gap-1.5" onClick={handleShare}>
          {copied ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" /> Link copied
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" aria-hidden="true" /> Share this live
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
