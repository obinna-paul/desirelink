"use client";

import { useState } from "react";
import { ArrowRight, Check, LoaderCircle, Sparkles } from "lucide-react";

import { SubscribePlansDialog } from "@/components/profile/subscribe-plans-dialog";
import { formatCents } from "@/lib/creator";
import type { PostSubscribePrompt } from "@/lib/posts";

const CTA_CLASSNAME =
  "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-[8px] bg-foreground px-5 text-sm font-semibold text-background shadow-sm transition-[background-color,transform,box-shadow] hover:bg-foreground/90 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 md:w-auto md:min-w-40";

export function PostSubscribeCta({
  prompt,
  creatorName,
}: {
  prompt: PostSubscribePrompt;
  creatorName: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const singleTier = prompt.tiers.length === 1 ? prompt.tiers[0] : null;

  async function subscribeToTier(tierId: string) {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/providers/${prompt.providerId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? "We couldn't start your subscription.");
        return;
      }
      if (body?.state === "checkout" && body.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }
      setSubscribed(true);
    } catch {
      setError("We couldn't start your subscription. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (subscribed) {
    return (
      <div className="flex min-h-11 items-center gap-2 border-t border-border/70 pt-3 text-sm font-semibold text-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
        You&apos;re subscribed to {creatorName}
      </div>
    );
  }

  return (
    <section aria-label={`Subscribe to ${creatorName}`} className="border-t border-border/70 pt-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-foreground">
              Get more from @{prompt.providerUsername}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Unlock premium posts and support {creatorName}&apos;s work.
            </p>
          </div>
        </div>

        {singleTier ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void subscribeToTier(singleTier.id)}
            className={CTA_CLASSNAME}
          >
            {pending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Starting...
              </>
            ) : (
              <>
                Subscribe · {formatCents(singleTier.priceCents)}/mo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        ) : (
          <SubscribePlansDialog
            providerId={prompt.providerId}
            tiers={prompt.tiers}
            renderTrigger={({ onClick }) => (
              <button type="button" onClick={onClick} className={CTA_CLASSNAME}>
                View subscription plans
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs leading-5 text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
