"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import type { Desire, DesireLevel, PrivacyLevel } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DESIRE_CATEGORIES,
  DESIRE_LEVEL_LABELS,
  DESIRE_LEVEL_OPTIONS,
  DESIRE_PRIVACY_LABELS,
  DESIRE_PRIVACY_OPTIONS,
  DEFAULT_DESIRE_PRIVACY,
  type DesireCategory,
} from "@/lib/desire-options";

type DesireState = Record<
  DesireCategory,
  { level: DesireLevel | null; privacy: PrivacyLevel }
>;

const LEVEL_DESCRIPTIONS: Record<DesireLevel, string> = {
  curious: "A light signal. You may explore it later, but it should not lead matching.",
  interested: "You want this considered, but it is not the main reason you are here.",
  looking: "A strong signal. Prioritize people, rooms, and events aligned with this.",
  regular: "One of your strongest recurring preferences.",
  hard_limit: "Do not recommend this. Keep it marked as a boundary.",
};

const PRIVACY_DESCRIPTIONS: Record<PrivacyLevel, string> = {
  public: "Visible on your profile when others can view your Desire Map.",
  followers: "Visible only to followers and approved connections.",
  private: "Used for matching, hidden from your public profile.",
};

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

function getInitialActiveCategory(initialDesires: Pick<Desire, "category">[]): DesireCategory {
  const matchingCategory = initialDesires.find((desire) =>
    DESIRE_CATEGORIES.includes(desire.category as DesireCategory)
  )?.category;

  return (matchingCategory as DesireCategory | undefined) ?? DESIRE_CATEGORIES[0];
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
  const [activeCategory, setActiveCategory] = useState<DesireCategory>(
    () => getInitialActiveCategory(initialDesires)
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const selectedDesires = useMemo(
    () =>
      DESIRE_CATEGORIES.filter((category) => state[category].level !== null).map((category) => ({
        category,
        level: state[category].level as DesireLevel,
        privacy: state[category].privacy,
      })),
    [state]
  );

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return DESIRE_CATEGORIES;

    return DESIRE_CATEGORIES.filter((category) => category.toLowerCase().includes(normalizedQuery));
  }, [query]);

  const activeValue = state[activeCategory];
  const selectedCount = selectedDesires.length;

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

  function clearCategory(category: DesireCategory) {
    setState((prev) => ({
      ...prev,
      [category]: { ...prev[category], level: null },
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setStatus("saving");

    const desires = selectedDesires.map((desire) => ({
      category: desire.category,
      level: desire.level,
      privacy: desire.privacy,
    }));

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
    setStatus("idle");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-background/45 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{selectedCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">of {DESIRE_CATEGORIES.length} signals</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/45 p-4 sm:col-span-2">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neon-pink" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">Private by default</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Udala can use private signals for recommendations without showing them on your public profile.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-background/35">
        <div className="border-b border-border/70 p-4 sm:p-5">
          <label htmlFor="desire-search" className="text-sm font-semibold text-foreground">
            Choose a category
          </label>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="desire-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-xl border border-border/70 bg-card pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-neon-pink focus:ring-2 focus:ring-neon-pink/20"
              placeholder="Search desires"
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-[270px_minmax(0,1fr)]">
          <div className="border-b border-border/70 lg:max-h-[520px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <div className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
              {filteredCategories.map((category) => {
                const value = state[category];
                const isActive = category === activeCategory;
                const isSelected = value.level !== null;

                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      "flex min-h-11 w-max min-w-[180px] items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors lg:w-full lg:min-w-0",
                      isActive
                        ? "border-neon-pink bg-neon-pink/10 text-foreground"
                        : "border-border/60 bg-card text-muted-foreground hover:border-neon-pink/40 hover:text-foreground"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{category}</span>
                      <span className="mt-0.5 block truncate text-xs">
                        {isSelected ? DESIRE_LEVEL_LABELS[value.level as DesireLevel] : "Not set"}
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-neon-pink" aria-hidden="true" />}
                  </button>
                );
              })}

              {filteredCategories.length === 0 && (
                <p className="px-2 py-4 text-sm text-muted-foreground">No matching categories.</p>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current category</p>
                <h3 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">
                  {activeCategory}
                </h3>
              </div>
              {activeValue.level && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => clearCategory(activeCategory)}
                  className="w-full justify-center text-muted-foreground sm:w-auto"
                >
                  <X className="h-4 w-4" aria-hidden="true" /> Clear
                </Button>
              )}
            </div>

            <div className="mt-5 grid gap-2">
              {DESIRE_LEVEL_OPTIONS.map((option) => {
                const isSelected = activeValue.level === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setLevel(activeCategory, option.value)}
                    className={cn(
                      "flex min-h-[68px] items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                      isSelected
                        ? "border-neon-pink bg-neon-pink/10 shadow-card"
                        : "border-border/60 bg-card hover:border-neon-pink/40 hover:bg-accent/60"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                        isSelected
                          ? "border-neon-pink bg-neon-pink text-primary-foreground"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {isSelected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                        {LEVEL_DESCRIPTIONS[option.value]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {activeValue.level && (
              <div className="mt-5 rounded-xl border border-border/70 bg-card p-4">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-neon-pink" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Visibility for {activeCategory}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {PRIVACY_DESCRIPTIONS[activeValue.privacy]}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {DESIRE_PRIVACY_OPTIONS.map((option) => {
                    const isSelected = activeValue.privacy === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setPrivacy(activeCategory, option.value)}
                        className={cn(
                          "min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors",
                          isSelected
                            ? "border-neon-pink bg-neon-pink text-primary-foreground"
                            : "border-border/70 bg-background/60 text-muted-foreground hover:border-neon-pink/40 hover:text-foreground"
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedDesires.length > 0 && (
        <section className="rounded-2xl border border-border/70 bg-background/35 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neon-pink" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">Your selected signals</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedDesires.map((desire) => (
              <button
                key={desire.category}
                type="button"
                onClick={() => setActiveCategory(desire.category)}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border/70 bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-neon-pink/40"
              >
                {desire.category}
                <span className="text-muted-foreground">
                  {DESIRE_LEVEL_LABELS[desire.level]} / {DESIRE_PRIVACY_LABELS[desire.privacy]}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lift backdrop-blur sm:static sm:flex-row sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <Button type="submit" disabled={status === "saving"} className="h-12">
          {status === "saving" ? "Saving..." : submitLabel}
        </Button>
        {skipHref && (
          <Button type="button" variant="outline" className="h-12" onClick={() => router.push(skipHref)}>
            Skip for now
          </Button>
        )}
      </div>
    </form>
  );
}
