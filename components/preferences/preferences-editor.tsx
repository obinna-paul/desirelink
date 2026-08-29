"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, LockKeyhole, X } from "lucide-react";
import type { Desire, DesireLevel, PrivacyLevel } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DESIRE_PRIVACY,
  DESIRE_CATEGORIES,
  PREFERENCE_GROUPS,
  getPreferenceDescription,
  getPreferenceLabel,
  type DesireCategory,
} from "@/lib/desire-options";

type PreferenceState = Record<DesireCategory, { level: DesireLevel | null; privacy: PrivacyLevel }>;
type PreferenceStepId = "looking" | "enjoy" | "avoid";

const STEPS: {
  id: PreferenceStepId;
  title: string;
  description: string;
  level: DesireLevel;
  helper: string;
}[] = [
  {
    id: "looking",
    title: "What are you hoping to find?",
    description: "Choose the experiences Udala should prioritize for you.",
    level: "looking",
    helper: "These carry the strongest recommendation weight.",
  },
  {
    id: "enjoy",
    title: "What do you usually enjoy?",
    description: "Pick what already feels natural or interesting to you.",
    level: "regular",
    helper: "These help recommendations feel familiar, not random.",
  },
  {
    id: "avoid",
    title: "What should we avoid showing you?",
    description: "Set boundaries so recommendations stay comfortable.",
    level: "hard_limit",
    helper: "These stay private and reduce unwanted recommendations.",
  },
];

const REVIEW_GROUPS: { level: DesireLevel; label: string }[] = [
  { level: "looking", label: "Hoping to find" },
  { level: "regular", label: "Usually enjoy" },
  { level: "interested", label: "Interested in" },
  { level: "hard_limit", label: "Avoiding" },
];

function buildInitialState(initialPreferences: Pick<Desire, "category" | "level" | "privacy">[]) {
  const byCategory = new Map(initialPreferences.map((preference) => [preference.category, preference]));

  return DESIRE_CATEGORIES.reduce((state, category) => {
    const existing = byCategory.get(category);
    state[category] = {
      level: existing?.level ?? null,
      privacy: existing?.privacy ?? DEFAULT_DESIRE_PRIVACY,
    };
    return state;
  }, {} as PreferenceState);
}

function getInitialStep(initialPreferences: Pick<Desire, "level">[]): number {
  if (initialPreferences.some((preference) => preference.level === "looking")) return 0;
  if (initialPreferences.some((preference) => preference.level === "regular" || preference.level === "interested")) return 1;
  if (initialPreferences.some((preference) => preference.level === "hard_limit")) return 2;
  return 0;
}

function levelForStep(step: PreferenceStepId, enjoyStrength: "regular" | "interested"): DesireLevel {
  if (step === "enjoy") return enjoyStrength;
  return STEPS.find((item) => item.id === step)?.level ?? "looking";
}

function StepRail({
  activeIndex,
  selectedCount,
  onSelect,
}: {
  activeIndex: number;
  selectedCount: number;
  onSelect: (index: number) => void;
}) {
  return (
    <aside className="hidden rounded-2xl border border-border/70 bg-background/45 p-3 lg:block">
      <div className="mb-4 rounded-xl bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progress</p>
        <p className="mt-2 font-heading text-3xl font-semibold text-foreground">{selectedCount}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">preferences selected</p>
      </div>

      <div className="space-y-2">
        {STEPS.map((step, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex min-h-[72px] w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 bg-card text-foreground hover:bg-secondary"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  isActive ? "border-background/30 bg-background/10" : "border-border/70 bg-secondary"
                )}
              >
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold">{step.title}</span>
                <span className={cn("mt-1 block text-xs leading-5", isActive ? "text-background/70" : "text-muted-foreground")}>
                  {step.helper}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function PreferenceChip({
  category,
  selected,
  onToggle,
}: {
  category: DesireCategory;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "group flex min-h-[72px] items-start gap-3 rounded-2xl border p-3 text-left transition-[background,border-color,box-shadow,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
        selected
          ? "border-foreground bg-foreground text-background shadow-lift"
          : "border-border/70 bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-secondary"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-background/30 bg-background/10" : "border-border bg-background"
        )}
      >
        {selected && <Check className="h-4 w-4" aria-hidden="true" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{getPreferenceLabel(category)}</span>
        <span className={cn("mt-1 block text-xs leading-5", selected ? "text-background/72" : "text-muted-foreground")}>
          {getPreferenceDescription(category)}
        </span>
      </span>
    </button>
  );
}

function ReviewPanel({
  selectedPreferences,
  showOnProfile,
  onShowOnProfileChange,
  onRemove,
}: {
  selectedPreferences: { category: DesireCategory; level: DesireLevel; privacy: PrivacyLevel }[];
  showOnProfile: boolean;
  onShowOnProfileChange: (value: boolean) => void;
  onRemove: (category: DesireCategory) => void;
}) {
  return (
    <aside className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Private by default</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Preferences improve matching without being shown publicly unless you choose otherwise.
          </p>
        </div>
      </div>

      <label className="mt-4 flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/55 px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {showOnProfile ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
          Show selected preferences on my profile
        </span>
        <Switch checked={showOnProfile} onCheckedChange={onShowOnProfileChange} />
      </label>

      <div className="mt-5 space-y-4">
        {selectedPreferences.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/50 p-4 text-sm leading-6 text-muted-foreground">
            Your choices will appear here as you select them.
          </div>
        ) : (
          REVIEW_GROUPS.map((group) => {
            const items = selectedPreferences.filter((preference) => preference.level === group.level);
            if (items.length === 0) return null;

            return (
              <div key={group.level}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {items.map((preference) => (
                    <button
                      key={preference.category}
                      type="button"
                      onClick={() => onRemove(preference.category)}
                      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40"
                    >
                      {getPreferenceLabel(preference.category)}
                      <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

export function PreferencesEditor({
  initialPreferences,
  redirectTo,
  submitLabel = "Save preferences",
  skipHref,
}: {
  initialPreferences: Pick<Desire, "category" | "level" | "privacy">[];
  redirectTo: string;
  submitLabel?: string;
  skipHref?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PreferenceState>(() => buildInitialState(initialPreferences));
  const [activeIndex, setActiveIndex] = useState(() => getInitialStep(initialPreferences));
  const [enjoyStrength, setEnjoyStrength] = useState<"regular" | "interested">("regular");
  const [showOnProfile, setShowOnProfile] = useState(() =>
    initialPreferences.some((preference) => preference.privacy === "public")
  );
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const activeStep = STEPS[activeIndex];
  const activeLevel = levelForStep(activeStep.id, enjoyStrength);
  const selectedPreferences = useMemo(
    () =>
      DESIRE_CATEGORIES.filter((category) => state[category].level !== null).map((category) => ({
        category,
        level: state[category].level as DesireLevel,
        privacy: state[category].privacy,
      })),
    [state]
  );

  function togglePreference(category: DesireCategory) {
    setState((current) => {
      const existing = current[category];
      const selectedInStep = existing.level === activeLevel;

      return {
        ...current,
        [category]: {
          level: selectedInStep ? null : activeLevel,
          privacy: showOnProfile && activeStep.id !== "avoid" ? "public" : "private",
        },
      };
    });
  }

  function removePreference(category: DesireCategory) {
    setState((current) => ({
      ...current,
      [category]: { ...current[category], level: null, privacy: DEFAULT_DESIRE_PRIVACY },
    }));
  }

  function updateProfileVisibility(nextValue: boolean) {
    setShowOnProfile(nextValue);
    setState((current) =>
      DESIRE_CATEGORIES.reduce((next, category) => {
        const entry = current[category];
        next[category] = {
          ...entry,
          privacy: entry.level && entry.level !== "hard_limit" && nextValue ? "public" : "private",
        };
        return next;
      }, {} as PreferenceState)
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setStatus("saving");

    const preferences = selectedPreferences.map((preference) => ({
      category: preference.category,
      level: preference.level,
      privacy: preference.level !== "hard_limit" && showOnProfile ? "public" : "private",
    }));

    const res = await fetch("/api/desires", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ desires: preferences }),
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

  const isLastStep = activeIndex === STEPS.length - 1;

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_320px]">
      <StepRail activeIndex={activeIndex} selectedCount={selectedPreferences.length} onSelect={setActiveIndex} />

      <section className="min-w-0 rounded-[28px] border border-border/70 bg-background/45 p-4 shadow-sm sm:p-5 md:rounded-2xl">
        <div className="lg:hidden">
          <div className="flex gap-2" aria-label={`Step ${activeIndex + 1} of ${STEPS.length}`}>
            {STEPS.map((step, index) => (
              <span
                key={step.id}
                className={cn("h-1.5 flex-1 rounded-full transition-colors", index <= activeIndex ? "bg-foreground" : "bg-muted")}
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step {activeIndex + 1} of {STEPS.length}
          </p>
        </div>

        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between lg:mt-0">
          <div>
            <h3 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {activeStep.title}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{activeStep.description}</p>
          </div>

          {activeStep.id === "enjoy" && (
            <div className="grid grid-cols-2 rounded-full border border-border/70 bg-card p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setEnjoyStrength("regular")}
                className={cn(
                  "h-10 rounded-full px-4 transition-colors",
                  enjoyStrength === "regular" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Often
              </button>
              <button
                type="button"
                onClick={() => setEnjoyStrength("interested")}
                className={cn(
                  "h-10 rounded-full px-4 transition-colors",
                  enjoyStrength === "interested" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sometimes
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-5">
          {PREFERENCE_GROUPS.map((group) => (
            <div key={group.id}>
              <div className="mb-2">
                <p className="text-sm font-semibold text-foreground">{group.label}</p>
                <p className="text-xs leading-5 text-muted-foreground">{group.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.categories.map((category) => (
                  <PreferenceChip
                    key={category}
                    category={category}
                    selected={state[category].level === activeLevel}
                    onToggle={() => togglePreference(category)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {serverError && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <div className="sticky bottom-3 z-10 mt-5 flex flex-col-reverse gap-2 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lift backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 sm:flex-none"
              disabled={activeIndex === 0 || status === "saving"}
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
            </Button>
            {skipHref && (
              <Button type="button" variant="ghost" className="h-11 flex-1 sm:flex-none" onClick={() => router.push(skipHref)}>
                Skip
              </Button>
            )}
          </div>

          {isLastStep ? (
            <Button type="submit" disabled={status === "saving"} className="h-11">
              {status === "saving" ? "Saving..." : submitLabel}
            </Button>
          ) : (
            <Button type="button" className="h-11" onClick={() => setActiveIndex((index) => Math.min(STEPS.length - 1, index + 1))}>
              Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </section>

      <ReviewPanel
        selectedPreferences={selectedPreferences}
        showOnProfile={showOnProfile}
        onShowOnProfileChange={updateProfileVisibility}
        onRemove={removePreference}
      />
    </form>
  );
}
