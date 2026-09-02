import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COPY = {
  "premium-post": {
    eyebrow: "Premium content",
    title: "Switch to a provider account to publish paid posts.",
    description:
      "Provider accounts can create premium posts, list services, and set up monetization.",
    cta: "Switch account",
  },
  service: {
    eyebrow: "Service listings",
    title: "Switch to a provider account before listing services.",
    description:
      "Provider accounts can list paid services, add cover photos, manage bookings, and track earnings.",
    cta: "Switch account",
  },
} as const;

export type ProviderUpgradeIntent = keyof typeof COPY;

export function ProviderUpgradePrompt({
  intent,
  className,
}: {
  intent: ProviderUpgradeIntent;
  className?: string;
}) {
  const copy = COPY[intent];
  const href = `/settings/account-type?intent=${intent}`;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[8px] border border-border bg-card shadow-card",
        className
      )}
    >
      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {copy.eyebrow}
            </p>
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">
              {copy.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {copy.description}
            </p>
          </div>
        </div>
        <Button asChild className="h-11 w-full gap-2 rounded-[8px] bg-foreground text-background hover:bg-foreground/90 md:w-auto">
          <Link href={href}>
            {copy.cta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
