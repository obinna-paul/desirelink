"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PaymentMethodView } from "@/lib/billing";

function CardRow({
  card,
  onSetDefault,
  onRemove,
  pending,
}: {
  card: PaymentMethodView;
  onSetDefault: () => void;
  onRemove: () => void;
  pending: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
          <CreditCard className="h-5 w-5 text-neon-pink" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium capitalize">
            {card.brand} &middot;&middot;&middot;&middot; {card.last4}
          </p>
          <p className="text-xs text-muted-foreground">
            Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear} &middot; {card.country}
          </p>
        </div>
        {card.isDefault && (
          <Badge variant="neon" className="gap-1">
            <Check className="h-3 w-3" aria-hidden="true" /> Default
          </Badge>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {!card.isDefault && (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onSetDefault}>
            Set as default
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-destructive"
          disabled={pending}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Remove card</span>
        </Button>
      </div>
    </li>
  );
}

export function PaymentMethodManager({ initialCards }: { initialCards: PaymentMethodView[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setDefault(cardId: string) {
    setPendingId(cardId);
    setError(null);
    const res = await fetch(`/api/billing/cards/${cardId}`, { method: "PUT" });
    setPendingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't update your default card.");
      return;
    }
    setCards((prev) => prev.map((card) => ({ ...card, isDefault: card.id === cardId })));
    router.refresh();
  }

  async function remove(cardId: string) {
    setPendingId(cardId);
    setError(null);
    const res = await fetch(`/api/billing/cards/${cardId}`, { method: "DELETE" });
    setPendingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't remove that card.");
      return;
    }
    setCards((prev) => prev.filter((card) => card.id !== cardId));
    router.refresh();
  }

  async function addCard() {
    setAdding(true);
    setError(null);
    const res = await fetch("/api/billing/cards", { method: "POST" });
    const body = await res.json().catch(() => null);
    setAdding(false);
    if (!res.ok) {
      setError(body?.error ?? "Couldn't start checkout.");
      return;
    }
    window.location.href = body.checkoutUrl;
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No saved cards yet. Cards are saved automatically the first time you subscribe to something — udala
          premium, or a provider&apos;s tier.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {cards.map((card) => (
            <CardRow
              key={card.id}
              card={card}
              pending={pendingId === card.id}
              onSetDefault={() => setDefault(card.id)}
              onRemove={() => remove(card.id)}
            />
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {cards.length === 0 && (
        <Button type="button" className="w-fit" disabled={adding} onClick={addCard}>
          {adding ? "..." : "Add a card via udala premium"}
        </Button>
      )}
      {cards.length > 0 && (
        <p className="text-xs text-muted-foreground">
          To use a different card, remove this one and subscribe again — udala doesn&apos;t yet support saving more
          than one card at a time.
        </p>
      )}
    </div>
  );
}
