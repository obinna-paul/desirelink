"use client";

import { useState } from "react";
import useSWR from "swr";
import { Banknote, CheckCircle2, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PayoutSetupResponse = {
  payout: {
    status: string;
    provider: string;
    bankName: string | null;
    accountLast4: string | null;
    accountName: string | null;
    country: string | null;
    currency: string | null;
    updatedAt: string | null;
    balanceCents: number;
    minimumPayoutCents: number;
  };
};

async function fetcher(url: string) {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Could not load payout setup.");
  return body as PayoutSetupResponse;
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function PayoutSetup({ providerId }: { providerId: string }) {
  const endpoint = `/api/providers/${providerId}/payout-setup`;
  const { data, mutate, isLoading } = useSWR(endpoint, fetcher);
  const [form, setForm] = useState({
    name: "",
    recipientType: "nuban",
    accountNumber: "",
    bankCode: "",
    bankName: "",
    country: "",
    currency: "USD",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(body?.error ?? "Could not set up payouts.");
      return;
    }

    setForm((current) => ({ ...current, accountNumber: "" }));
    mutate();
  }

  const payout = data?.payout;
  const meetsThreshold = payout ? payout.balanceCents >= payout.minimumPayoutCents : false;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Payout setup</h2>
          <p className="text-xs text-muted-foreground">Monthly Paystack payouts run net 15 days.</p>
        </div>
        <Badge variant={payout?.status === "verified" ? "neon" : "outline"}>
          {isLoading ? "checking" : payout?.status ?? "not_started"}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-secondary/35 p-3">
          <p className="text-xs text-muted-foreground">Accumulated balance</p>
          <p className="mt-1 text-lg font-semibold">{formatCents(payout?.balanceCents ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/35 p-3">
          <p className="text-xs text-muted-foreground">Minimum payout</p>
          <p className="mt-1 text-lg font-semibold">{formatCents(payout?.minimumPayoutCents ?? 1000)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/35 p-3">
          <p className="text-xs text-muted-foreground">Threshold</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
            {meetsThreshold && <CheckCircle2 className="h-4 w-4 text-neon-cyan" aria-hidden="true" />}
            {meetsThreshold ? "Ready for next payout" : "Rolls over until eligible"}
          </p>
        </div>
      </div>

      {payout?.accountLast4 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Banknote className="h-4 w-4" aria-hidden="true" />
          {payout.bankName} ending in {payout.accountLast4}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Account name"
          aria-label="Account name"
        />
        <Input
          value={form.accountNumber}
          onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value }))}
          placeholder="Account number"
          aria-label="Account number"
          inputMode="numeric"
        />
        <Input
          value={form.recipientType}
          onChange={(event) => setForm((current) => ({ ...current, recipientType: event.target.value }))}
          placeholder="Recipient type"
          aria-label="Recipient type"
        />
        <Input
          value={form.bankCode}
          onChange={(event) => setForm((current) => ({ ...current, bankCode: event.target.value }))}
          placeholder="Bank code"
          aria-label="Bank code"
        />
        <Input
          value={form.bankName}
          onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))}
          placeholder="Bank name"
          aria-label="Bank name"
        />
        <Input
          value={form.country}
          onChange={(event) => setForm((current) => ({ ...current, country: event.target.value.toUpperCase() }))}
          placeholder="Country"
          aria-label="Country"
          maxLength={2}
        />
        <Input
          value={form.currency}
          onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
          placeholder="Currency"
          aria-label="Currency"
          maxLength={3}
        />
        <div className="md:col-span-2">
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full gap-2 md:w-auto" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Set up payouts
          </Button>
        </div>
      </form>
    </section>
  );
}
