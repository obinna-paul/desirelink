"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";

const AUTO_SUCCEED_MS = 4000;

type Status = "pending" | "succeeded" | "failed";

export function MockCheckout({
  transactionId,
  status: initialStatus,
  tierName,
  creatorName,
  creatorUsername,
  amountCents,
  kind = "subscription",
  backHref,
  backLabel = "Back to profile",
}: {
  transactionId: string;
  status: string;
  tierName: string;
  creatorName: string;
  creatorUsername: string | null;
  amountCents: number;
  kind?: "subscription" | "event";
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(
    initialStatus === "succeeded" ? "succeeded" : initialStatus === "failed" ? "failed" : "pending"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedRef = useRef(status !== "pending");

  async function resolve(type: "checkout.completed" | "checkout.failed") {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/payments/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, transactionId }),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      resolvedRef.current = false;
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStatus(body.status === "succeeded" ? "succeeded" : "failed");
    router.refresh();
  }

  useEffect(() => {
    if (status !== "pending") return;
    const timer = setTimeout(() => resolve("checkout.completed"), AUTO_SUCCEED_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6 md:rounded-xl md:shadow-none">
      <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <p className="text-sm font-medium">{tierName}</p>
          <p className="text-xs text-muted-foreground">
            {creatorUsername ? `@${creatorUsername}` : creatorName}
          </p>
        </div>
        <p className="text-lg font-semibold text-neon-cyan">{formatCents(amountCents)}</p>
      </div>

      {status === "pending" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-neon-pink" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Processing your mock payment...</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This completes automatically in a few seconds, or you can finish it now.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-center">
            <Button type="button" className="w-full sm:w-auto" disabled={submitting} onClick={() => resolve("checkout.completed")}>
              {submitting ? "Processing..." : "Simulate Payment Success"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={submitting}
              onClick={() => resolve("checkout.failed")}
            >
              Simulate Failure
            </Button>
          </div>
        </div>
      )}

      {status === "succeeded" && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-neon-cyan" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Payment complete</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {kind === "event"
                ? `You're going to ${tierName}.`
                : `You're now subscribed to ${tierName}.`}
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-center">
            {backHref ? (
              <Button asChild size="sm" className="w-full sm:w-auto">
                <Link href={backHref}>{backLabel}</Link>
              </Button>
            ) : (
              creatorUsername && (
                <Button asChild size="sm">
                  <Link href={`/profile/${creatorUsername}?section=membership`}>{backLabel}</Link>
                </Button>
              )
            )}
            {kind === "subscription" && (
              <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                <Link href="/settings/subscriptions">View subscriptions</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <XCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Payment failed</p>
            <p className="mt-1 text-xs text-muted-foreground">No charge was made.</p>
          </div>
          {backHref ? (
            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
              <Link href={backHref}>Try again</Link>
            </Button>
          ) : (
            creatorUsername && (
                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                <Link href={`/profile/${creatorUsername}?section=membership`}>Try again</Link>
              </Button>
            )
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
