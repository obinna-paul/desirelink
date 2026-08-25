"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Desire, DesireLevel, PrivacyLevel } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  DESIRE_CATEGORIES,
  DESIRE_LEVEL_OPTIONS,
  DESIRE_PRIVACY_OPTIONS,
  DEFAULT_DESIRE_PRIVACY,
  type DesireCategory,
} from "@/lib/desire-options";

type DesireState = Record<
  DesireCategory,
  { level: DesireLevel | null; privacy: PrivacyLevel }
>;

function buildInitialState(initialDesires: Pick<Desire, "category" | "level" | "privacy">[]) {
  const byCategory = new Map(initialDesires.map((desire) => [desire.category, desire]));

  return DESIRE_CATEGORIES.reduce((state, category) => {
    const existing = byCategory.get(category);
    state[category] = {
      level: existing?.level ?? null,
      privacy: existing?.privacy ?? DEFAULT_DESIRE_PRIVACY,
    };
    return state;
  }, {} as DesireState);
}

export function DesireMapEditor({
  initialDesires,
  redirectTo,
  submitLabel = "Save desire map",
  skipHref,
}: {
  initialDesires: Pick<Desire, "category" | "level" | "privacy">[];
  redirectTo: string;
  submitLabel?: string;
  skipHref?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<DesireState>(() => buildInitialState(initialDesires));
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const selectedCount = DESIRE_CATEGORIES.filter((category) => state[category].level !== null).length;

  function setLevel(category: DesireCategory, level: DesireLevel) {
    setState((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        level: prev[category].level === level ? null : level,
      },
    }));
  }

  function setPrivacy(category: DesireCategory, privacy: PrivacyLevel) {
    setState((prev) => ({
      ...prev,
      [category]: { ...prev[category], privacy },
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setStatus("saving");

    const desires = DESIRE_CATEGORIES.filter((category) => state[category].level !== null).map(
      (category) => ({
        category,
        level: state[category].level,
        privacy: state[category].privacy,
      })
    );

    const res = await fetch("/api/desires", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ desires }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus("idle");
      setServerError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {selectedCount} of {DESIRE_CATEGORIES.length} selected. Tap a level to select it again to
        clear it. Everything defaults to private until you say otherwise.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DESIRE_CATEGORIES.map((category) => {
          const value = state[category];
          const isSelected = value.level !== null;

          return (
            <div
              key={category}
              className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{category}</p>
                {isSelected && (
                  <button
                    type="button"
                    aria-label={`Clear ${category}`}
                    onClick={() =>
                      setState((prev) => ({ ...prev, [category]: { ...prev[category], level: null } }))
                    }
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {DESIRE_LEVEL_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={value.level === option.value ? "default" : "outline"}
                    aria-pressed={value.level === option.value}
                    className="min-h-11 px-2.5 text-xs"
                    onClick={() => setLevel(category, option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {isSelected && (
                <Select
                  aria-label={`${category} privacy`}
                  value={value.privacy}
                  onChange={(event) => setPrivacy(category, event.target.value as PrivacyLevel)}
                  className="h-8 text-xs"
                >
                  {DESIRE_PRIVACY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          );
        })}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : submitLabel}
        </Button>
        {skipHref && (
          <Button type="button" variant="outline" onClick={() => router.push(skipHref)}>
            Skip for now
          </Button>
        )}
      </div>
    </form>
  );
}
