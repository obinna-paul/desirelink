"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Banknote, CheckCircle2, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Bank = { name: string; code: string };

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
  if (!res.ok) throw new Error(body?.error ?? "Could not load this.");
  return body;
}

function formatCents(cents: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(cents / 100);
}

export function PayoutSetup({ providerId }: { providerId: string }) {
  const endpoint = `/api/providers/${providerId}/payout-setup`;
  const { data, mutate, isLoading } = useSWR<PayoutSetupResponse>(endpoint, fetcher);
  const { data: banksData } = useSWR<{ banks: Bank[] }>("/api/providers/banks", fetcher);

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const banks = banksData?.banks ?? [];
  const selectedBank = banks.find((bank) => bank.code === bankCode);

  // Auto-resolves the account holder's name straight from the bank once both
  // fields are filled in, so the provider never has to type their own name.
  useEffect(() => {
    setResolvedName(null);
    setResolveError(null);
    if (!bankCode || accountNumber.length !== 10) return;

    let cancelled = false;
    setResolving(true);

    const timeout = setTimeout(async () => {
      const res = await fetch(`${endpoint}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber, bankCode }),
      });
      const body = await res.json().catch(() => null);
      if (cancelled) return;

      setResolving(false);
      if (!res.ok) {
        setResolveError(body?.error ?? "Couldn't verify that account.");
        return;
      }
      setResolvedName(body.accountName);
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      setResolving(false);
    };
  }, [bankCode, accountNumber, endpoint]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!resolvedName || !selectedBank) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountNumber, bankCode, bankName: selectedBank.name }),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(body?.error ?? "Could not set up payouts.");
      return;
    }

    setAccountNumber("");
    setBankCode("");
    setResolvedName(null);
    mutate();
  }

  const payout = data?.payout;
  const meetsThreshold = payout ? payout.balanceCents >= payout.minimumPayoutCents : false;
  const canSubmit = Boolean(resolvedName && selectedBank) && !resolving && !submitting;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:p-5 md:shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Payout setup</h2>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Withdrawal requests are reviewed and paid out in full within 2–3 business days.
          </p>
        </div>
        <Badge variant={payout?.status === "verified" ? "neon" : "outline"} className="shrink-0 capitalize">
          {isLoading ? "checking" : (payout?.status ?? "not started").replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-secondary/35 p-3">
          <p className="text-xs text-muted-foreground">Wallet balance</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatCents(payout?.balanceCents ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/35 p-3">
          <p className="text-xs text-muted-foreground">Minimum withdrawal</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatCents(payout?.minimumPayoutCents ?? 1_500_000)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/35 p-3">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
            {meetsThreshold && <CheckCircle2 className="h-4 w-4 text-trust" aria-hidden="true" />}
            {meetsThreshold ? "Ready to withdraw" : "Below minimum"}
          </p>
        </div>
      </div>

      {payout?.accountLast4 ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/35 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-primary">
            <Banknote className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{payout.accountName}</p>
            <p className="text-xs text-muted-foreground">
              {payout.bankName} &middot; &bull;&bull;&bull;&bull; {payout.accountLast4}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="payout-bank" className="text-xs font-medium text-muted-foreground">
              Bank
            </label>
            <Select
              id="payout-bank"
              value={bankCode}
              onChange={(event) => setBankCode(event.target.value)}
            >
              <option value="">Choose your bank</option>
              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="payout-account" className="text-xs font-medium text-muted-foreground">
              Account number
            </label>
            <Input
              id="payout-account"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="0123456789"
              inputMode="numeric"
              maxLength={10}
            />
          </div>

          <div className="min-h-5">
            {resolving && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Verifying account&hellip;
              </p>
            )}
            {!resolving && resolvedName && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-trust">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> {resolvedName}
              </p>
            )}
            {!resolving && resolveError && (
              <p className="text-xs text-destructive">{resolveError}</p>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" className="w-full gap-2 md:w-auto" disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save payout details
          </Button>
        </form>
      )}
    </section>
  );
}
