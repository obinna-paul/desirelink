"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatCents, type CreatorTierWithCount } from "@/lib/creator";
import {
  DEFAULT_TIER_PRICE_CENTS,
  MAX_TIER_PRICE_CENTS,
  MIN_TIER_PRICE_CENTS,
  TIER_TYPE_VALUES,
  type CreatorTierInput,
} from "@/lib/validations/creator-tier";

type FormState = {
  name: string;
  description: string;
  priceNaira: string;
  tierType: (typeof TIER_TYPE_VALUES)[number];
  maxSubscribers: string;
  isLimited: boolean;
  requiresApproval: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  priceNaira: (DEFAULT_TIER_PRICE_CENTS / 100).toString(),
  tierType: "basic",
  maxSubscribers: "",
  isLimited: false,
  requiresApproval: false,
};

function tierToForm(tier: CreatorTierWithCount): FormState {
  return {
    name: tier.name,
    description: tier.description,
    priceNaira: (tier.priceCents / 100).toString(),
    tierType: tier.tierType as FormState["tierType"],
    maxSubscribers: tier.maxSubscribers ? String(tier.maxSubscribers) : "",
    isLimited: tier.isLimited,
    requiresApproval: tier.requiresApproval,
  };
}

function TierForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial: FormState;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (input: CreatorTierInput) => Promise<string | null>;
}) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const priceNaira = Number(form.priceNaira);
    const minPriceNaira = MIN_TIER_PRICE_CENTS / 100;
    const maxPriceNaira = MAX_TIER_PRICE_CENTS / 100;
    if (!form.name.trim() || Number.isNaN(priceNaira)) {
      setError("Enter a tier name and a valid price.");
      return;
    }
    if (priceNaira < minPriceNaira) {
      setError(`Tier price must be at least ₦${minPriceNaira.toFixed(2)}.`);
      return;
    }
    if (priceNaira > maxPriceNaira) {
      setError(`Tier price can't exceed ₦${maxPriceNaira.toFixed(2)}.`);
      return;
    }

    setStatus("saving");
    const result = await onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      priceNaira,
      tierType: form.tierType,
      maxSubscribers: form.maxSubscribers ? Number(form.maxSubscribers) : null,
      isLimited: form.isLimited,
      requiresApproval: form.requiresApproval,
    });
    setStatus("idle");

    if (result) {
      setError(result);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm md:rounded-lg md:bg-background md:p-4 md:shadow-none"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tier-name" className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input
            id="tier-name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. VIP"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tier-price" className="text-xs font-medium text-muted-foreground">
            Price per month (NGN, ₦{(MIN_TIER_PRICE_CENTS / 100).toFixed(2)}-₦{(MAX_TIER_PRICE_CENTS / 100).toFixed(2)})
          </label>
          <Input
            id="tier-price"
            type="number"
            min={MIN_TIER_PRICE_CENTS / 100}
            max={MAX_TIER_PRICE_CENTS / 100}
            step="0.01"
            value={form.priceNaira}
            onChange={(event) => setForm((prev) => ({ ...prev, priceNaira: event.target.value }))}
            placeholder="10500.00"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:w-56">
        <label htmlFor="tier-type" className="text-xs font-medium text-muted-foreground">
          Tier type
        </label>
        <Select
          id="tier-type"
          value={form.tierType}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, tierType: event.target.value as FormState["tierType"] }))
          }
        >
          {TIER_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tier-description" className="text-xs font-medium text-muted-foreground">
          Description
        </label>
        <Textarea
          id="tier-description"
          rows={2}
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="What Fans get at this tier"
          className="resize-none rounded-2xl text-base md:rounded-md md:text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:w-56">
        <label htmlFor="tier-max" className="text-xs font-medium text-muted-foreground">
          Max Fans (optional)
        </label>
        <Input
          id="tier-max"
          type="number"
          min={1}
          value={form.maxSubscribers}
          onChange={(event) => setForm((prev) => ({ ...prev, maxSubscribers: event.target.value }))}
          placeholder="Unlimited"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={form.isLimited}
            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isLimited: checked }))}
          />
          Limited availability
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={form.requiresApproval}
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, requiresApproval: checked }))
            }
          />
          Requires approval
        </label>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="sm" disabled={status === "saving"} className="w-full sm:w-auto">
          {status === "saving" ? "Saving..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function TierManager({ initialTiers }: { initialTiers: CreatorTierWithCount[] }) {
  const router = useRouter();
  const [tiers, setTiers] = useState(initialTiers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate(input: CreatorTierInput) {
    const res = await fetch("/api/creator/tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return body?.error ?? "Couldn't create tier.";
    }

    const { tier } = await res.json();
    setTiers((prev) => [...prev, { ...tier, _count: { subscriptions: 0 } }]);
    setCreating(false);
    router.refresh();
    return null;
  }

  async function handleUpdate(id: string, input: CreatorTierInput) {
    const res = await fetch(`/api/creator/tiers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return body?.error ?? "Couldn't update tier.";
    }

    const { tier } = await res.json();
    setTiers((prev) => prev.map((existing) => (existing.id === id ? { ...existing, ...tier } : existing)));
    setEditingId(null);
    router.refresh();
    return null;
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this tier? Any active subscriptions on it will be removed too.")) {
      return;
    }

    const res = await fetch(`/api/creator/tiers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTiers((prev) => prev.filter((tier) => tier.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {tiers.length === 0 && !creating && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
          You don&apos;t have any subscription tiers yet.
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {tiers.map((tier) =>
          editingId === tier.id ? (
            <li key={tier.id}>
              <TierForm
                initial={tierToForm(tier)}
                submitLabel="Save changes"
                onCancel={() => setEditingId(null)}
                onSubmit={(input) => handleUpdate(tier.id, input)}
              />
            </li>
          ) : (
            <li
              key={tier.id}
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between md:rounded-lg md:p-4 md:shadow-none"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold md:text-sm">{tier.name}</p>
                  <span className="text-sm text-neon-cyan">{formatCents(tier.priceCents)}/mo</span>
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs capitalize text-muted-foreground">
                    {tier.tierType}
                  </span>
                </div>
                {tier.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground md:mt-0.5 md:truncate md:text-xs">{tier.description}</p>
                )}
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {tier._count.subscriptions}
                  {tier.maxSubscribers ? ` / ${tier.maxSubscribers}` : ""} Fans
                </p>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setEditingId(tier.id)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive"
                  onClick={() => handleDelete(tier.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                </Button>
              </div>
            </li>
          )
        )}
      </ul>

      {creating ? (
        <TierForm
          initial={EMPTY_FORM}
          submitLabel="Create tier"
          onCancel={() => setCreating(false)}
          onSubmit={handleCreate}
        />
      ) : (
        <Button type="button" variant="outline" className="w-full gap-1.5 md:w-fit" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add tier
        </Button>
      )}
    </div>
  );
}
