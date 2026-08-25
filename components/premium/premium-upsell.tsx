"use client";

import { Crown, LockKeyhole, Sparkles } from "lucide-react";

import { SubscribePremiumButton } from "@/components/billing/BillingActions";
import { cn } from "@/lib/utils";

const DEFAULT_BENEFITS = [
  "Unlimited messaging",
  "Unlimited provider content",
  "Join any public room",
  "Priority event RSVPs",
  "Incognito browsing",
  "Advanced search filters",
  "See who viewed your profile",
  "Ad-free experience",
  "Your subscription supports Creators, Pairs, and Service Providers — 70% goes to them",
];

export function PremiumUpsell({
  title = "Unlock udala premium",
  description = "Upgrade for fewer limits and more control over how you connect.",
  benefits = DEFAULT_BENEFITS,
  compact = false,
  className,
}: {
  title?: string;
  description?: string;
  benefits?: string[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-primary/35 bg-card p-4 shadow-card",
        compact ? "space-y-3" : "space-y-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/15 text-primary">
          <Crown className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {!compact && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {benefits.slice(0, 6).map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-pink" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/45 p-3">
        <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>{benefits[benefits.length - 1]}</span>
        </p>
        <SubscribePremiumButton />
      </div>
    </section>
  );
}
