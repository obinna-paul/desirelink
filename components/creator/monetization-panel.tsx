"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MonetizationEligibility } from "@/lib/monetization";

function RequirementRow({ requirement }: { requirement: MonetizationEligibility["requirements"][number] }) {
  const detail =
    requirement.kind === "count" ? `${requirement.current} / ${requirement.required}` : requirement.detail;

  return (
    <li className="flex items-start justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-start gap-2">
        {requirement.met ? (
          <Check className="h-4 w-4 shrink-0 text-neon-cyan" aria-hidden="true" />
        ) : (
          <X className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        {requirement.label}
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{detail}</span>
    </li>
  );
}

export function MonetizationPanel({
  providerId,
  eligibility,
}: {
  providerId: string;
  eligibility: MonetizationEligibility;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/providers/${providerId}/monetization`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.refresh();
  }

  if (eligibility.isMonetized) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-xl md:shadow-none">
        <div className="flex items-center gap-2">
          <Badge variant="neon" className="gap-1">
            <Check className="h-3 w-3" aria-hidden="true" /> Monetized
          </Badge>
          {eligibility.monetizedAt && (
            <span className="text-xs text-muted-foreground">
              since {new Date(eligibility.monetizedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Your engagement with Premium users counts toward the rewards pool. Fans and your own tier revenue are
          unaffected either way.
        </p>
      </div>
    );
  }

  if (eligibility.monetizationStatus === "suspended") {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-card p-4 shadow-sm md:rounded-xl md:shadow-none">
        <Badge variant="outline" className="text-destructive">
          Monetization suspended
        </Badge>
        <p className="mt-2 text-sm text-muted-foreground">
          Monetization was suspended for this account. Your Fan (tier subscriber) revenue is unaffected - contact
          support to appeal the suspension.
        </p>
      </div>
    );
  }

  if (eligibility.monetizationStatus === "pending") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-xl md:shadow-none">
        <Badge variant="outline">Application pending review</Badge>
        <p className="mt-2 text-sm text-muted-foreground">
          {eligibility.pendingApplicationSince && (
            <>Applied {new Date(eligibility.pendingApplicationSince).toLocaleDateString()}. </>
          )}
          An admin reviews monetization applications manually - your Fans and tier revenue are unaffected while you
          wait.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-xl md:shadow-none">
      <h3 className="text-sm font-semibold">Enable monetization</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Meet these requirements to apply - an admin reviews every application before it&apos;s approved. This never
        affects your own Fans - you can keep earning from tier subscriptions either way.
      </p>
      {eligibility.monetizationStatus === "denied" && (
        <p className="mt-2 text-xs text-destructive">
          Your last application was denied. You can apply again once you still meet the requirements below.
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-2">
        {eligibility.requirements.map((requirement) => (
          <RequirementRow key={requirement.key} requirement={requirement} />
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <Button type="button" className="mt-3 w-full md:w-auto" disabled={pending || !eligibility.eligible} onClick={handleApply}>
        {pending ? "..." : eligibility.eligible ? "Apply for monetization" : "Requirements not met yet"}
      </Button>
    </div>
  );
}
