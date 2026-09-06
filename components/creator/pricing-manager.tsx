"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { TierPrice } from "@/components/subscriptions/tier-price";
import { DEFAULT_TIER_PRICE_CENTS, TIER_TYPE_VALUES, TIER_TYPE_LABELS } from "@/lib/validations/creator-tier";
import type { CreatorTierInput } from "@/lib/validations/creator-tier";

/** Local mirror of CreatorTierWithCount's shape - avoids importing lib/creator.ts (which
 * pulls in prisma) into this client component. */
type TierView = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  tierType: string;
  maxSubscribers: number | null;
  isLimited: boolean;
  _count: { subscriptions: number };
};

type FormState = {
  name: string;
  description: string;
  priceNaira: string;
  compareAtPriceNaira: string;
  tierType: string;
  isLimited: boolean;
  maxSubscribers: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  priceNaira: (DEFAULT_TIER_PRICE_CENTS / 100).toString(),
  compareAtPriceNaira: "",
  tierType: "beginner",
  isLimited: false,
  maxSubscribers: "",
};

function tierToForm(tier: TierView): FormState {
  return {
    name: tier.name,
    description: tier.description,
    priceNaira: (tier.priceCents / 100).toString(),
    compareAtPriceNaira: tier.compareAtPriceCents
      ? (tier.compareAtPriceCents / 100).toString()
      : "",
    tierType: tier.tierType,
    isLimited: tier.isLimited,
    maxSubscribers: tier.maxSubscribers?.toString() ?? "",
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
  const fieldId = useId();
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const compareAtPriceValue = form.compareAtPriceNaira.trim()
    ? Number(form.compareAtPriceNaira)
    : null;
  const compareAtPriceError =
    compareAtPriceValue !== null &&
    (Number.isNaN(compareAtPriceValue) || compareAtPriceValue <= Number(form.priceNaira))
      ? "Original price must be higher than the current price."
      : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const priceNaira = Number(form.priceNaira);
    const compareAtPriceNaira = form.compareAtPriceNaira.trim()
      ? Number(form.compareAtPriceNaira)
      : null;
    if (!form.name.trim()) {
      setError("Give this tier a name.");
      return;
    }
    if (Number.isNaN(priceNaira) || priceNaira <= 0) {
      setError("Enter a price greater than ₦0.");
      return;
    }
    if (
      compareAtPriceNaira !== null &&
      (Number.isNaN(compareAtPriceNaira) || compareAtPriceNaira <= priceNaira)
    ) {
      setError("Original price must be higher than the current price.");
      return;
    }
    const maxSubscribers = form.isLimited ? Number(form.maxSubscribers) : null;
    if (form.isLimited && (!Number.isInteger(maxSubscribers) || (maxSubscribers ?? 0) < 1)) {
      setError("Enter a valid subscriber limit.");
      return;
    }

    setStatus("saving");
    const result = await onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      priceNaira,
      compareAtPriceNaira,
      tierType: form.tierType as CreatorTierInput["tierType"],
      maxSubscribers,
      isLimited: form.isLimited,
    });
    setStatus("idle");

    if (result) setError(result);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-4 shadow-sm md:rounded-lg md:shadow-none"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-name`} className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input
            id={`${fieldId}-name`}
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. Subscriber"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-type`} className="text-xs font-medium text-muted-foreground">
            Type
          </label>
          <Select id={`${fieldId}-type`} value={form.tierType} onChange={(event) => setForm((prev) => ({ ...prev, tierType: event.target.value }))}>
            {TIER_TYPE_VALUES.map((type) => (
              <option key={type} value={type}>
                {TIER_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${fieldId}-description`} className="text-xs font-medium text-muted-foreground">
          What subscribers get
        </label>
        <Textarea
          id={`${fieldId}-description`}
          rows={2}
          className="resize-none rounded-2xl md:rounded-md"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Access to premium posts, DMs, hearts perks..."
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-price`} className="text-xs font-medium text-muted-foreground">
            Monthly price
          </label>
          <Input
            id={`${fieldId}-price`}
            type="number"
            min={0.01}
            step="0.01"
            value={form.priceNaira}
            onChange={(event) => setForm((prev) => ({ ...prev, priceNaira: event.target.value }))}
          />
          <p className="text-[11px] text-muted-foreground">This is what subscribers pay.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-compare-price`} className="text-xs font-medium text-muted-foreground">
            Original price <span className="font-normal">(optional)</span>
          </label>
          <Input
            id={`${fieldId}-compare-price`}
            type="number"
            min={0.01}
            step="0.01"
            value={form.compareAtPriceNaira}
            aria-invalid={Boolean(compareAtPriceError)}
            aria-describedby={`${fieldId}-compare-price-help`}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, compareAtPriceNaira: event.target.value }))
            }
            placeholder="Leave blank if not discounted"
          />
          <p
            id={`${fieldId}-compare-price-help`}
            className={`text-[11px] ${compareAtPriceError ? "text-destructive" : "text-muted-foreground"}`}
          >
            {compareAtPriceError ??
              "Shown crossed out when it is higher than your monthly price."}
          </p>
        </div>
      </div>

      {Number(form.priceNaira) > 0 &&
        form.compareAtPriceNaira.trim() &&
        Number(form.compareAtPriceNaira) > Number(form.priceNaira) && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/70 px-3 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Subscriber preview</span>
            <TierPrice
              priceCents={Math.round(Number(form.priceNaira) * 100)}
              compareAtPriceCents={Math.round(Number(form.compareAtPriceNaira) * 100)}
              className="justify-end"
            />
          </div>
        )}

      <label className="flex min-h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isLimited}
          onChange={(event) => setForm((prev) => ({ ...prev, isLimited: event.target.checked }))}
          className="h-4 w-4"
        />
        Limit the number of subscribers
      </label>
      {form.isLimited && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-max`} className="text-xs font-medium text-muted-foreground">
            Max subscribers
          </label>
          <Input
            id={`${fieldId}-max`}
            type="number"
            min={1}
            value={form.maxSubscribers}
            onChange={(event) => setForm((prev) => ({ ...prev, maxSubscribers: event.target.value }))}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:flex">
        <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function PricingManager({ initialTiers }: { initialTiers: TierView[] }) {
  const router = useRouter();
  const [tiers, setTiers] = useState(initialTiers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(initialTiers.length === 0);

  async function handleCreate(input: CreatorTierInput) {
    const res = await fetch("/api/creator/tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return body?.error ?? "Couldn't create this tier.";
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
      return body?.error ?? "Couldn't update this tier.";
    }

    setTiers((prev) =>
      prev.map((tier) =>
        tier.id === id
          ? {
              ...tier,
              ...input,
              priceCents: Math.round(input.priceNaira * 100),
              compareAtPriceCents:
                input.compareAtPriceNaira === null
                  ? null
                  : Math.round(input.compareAtPriceNaira * 100),
            }
          : tier
      )
    );
    setEditingId(null);
    router.refresh();
    return null;
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this tier? Subscribers will keep access until their current period ends, then it's gone for good.")) return;

    const res = await fetch(`/api/creator/tiers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTiers((prev) => prev.filter((tier) => tier.id !== id));
      router.refresh();
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm">Pricing</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Subscribers pay this monthly to unlock everything in your Premium tab. Marking a post as Premium doesn&apos;t
          set its own price - it unlocks for whoever is subscribed to any tier below.
        </p>
      </div>

      {tiers.length === 0 && !creating && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
          You don&apos;t have a subscription tier yet - premium posts stay locked for everyone until you create one.
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
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between md:rounded-lg md:shadow-none"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{tier.name}</p>
                  <TierPrice
                    priceCents={tier.priceCents}
                    compareAtPriceCents={tier.compareAtPriceCents}
                  />
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
                    {TIER_TYPE_LABELS[tier.tierType as keyof typeof TIER_TYPE_LABELS] ?? tier.tierType}
                  </span>
                </div>
                {tier.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{tier.description}</p>}
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {tier._count.subscriptions} subscriber{tier._count.subscriptions === 1 ? "" : "s"}
                  {tier.isLimited && tier.maxSubscribers ? ` of ${tier.maxSubscribers} max` : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 sm:w-auto"
                  onClick={() => {
                    setCreating(false);
                    setEditingId(tier.id);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 text-destructive sm:w-auto"
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
        <TierForm initial={EMPTY_FORM} submitLabel="Create tier" onCancel={tiers.length > 0 ? () => setCreating(false) : undefined} onSubmit={handleCreate} />
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-1.5 sm:w-fit"
          onClick={() => {
            setEditingId(null);
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add tier
        </Button>
      )}
    </section>
  );
}
