"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Eye, LockKeyhole } from "lucide-react";
import type { Desire, DesireLevel } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  SIMPLE_PREFERENCE_CATEGORIES,
  getPreferenceDescription,
  getPreferenceLabel,
  type DesireCategory,
} from "@/lib/desire-options";

type ChoiceState = Partial<Record<DesireCategory, DesireLevel>>;

const STEPS: { id: string; title: string; description: string; level: DesireLevel }[] = [
  {
    id: "find",
    title: "What would you like to find?",
    description: "Choose what Udala should prioritize across Discover, events, and people nearby.",
    level: "looking",
  },
  {
    id: "enjoy",
    title: "What do you already enjoy?",
    description: "These choices make your feed and recommendations feel more familiar.",
    level: "regular",
  },
  {
    id: "avoid",
    title: "What should we show less of?",
    description: "Set quiet boundaries. These choices always remain private.",
    level: "hard_limit",
  },
];

function buildInitialState(initialPreferences: Pick<Desire, "category" | "level">[]): ChoiceState {
  const allowed = new Set<string>(SIMPLE_PREFERENCE_CATEGORIES);
  return initialPreferences.reduce<ChoiceState>((state, preference) => {
    if (allowed.has(preference.category)) state[preference.category as DesireCategory] = preference.level;
    return state;
  }, {});
}

export function PreferencesEditor({
  initialPreferences,
  redirectTo,
  submitLabel = "Save preferences",
}: {
  initialPreferences: Pick<Desire, "category" | "level" | "privacy">[];
  redirectTo: string;
  submitLabel?: string;
  skipHref?: string;
}) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [choices, setChoices] = useState<ChoiceState>(() => buildInitialState(initialPreferences));
  const [showOnProfile, setShowOnProfile] = useState(() =>
    initialPreferences.some((preference) => preference.privacy === "public")
  );
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[activeIndex];
  const selectedCount = useMemo(() => Object.keys(choices).length, [choices]);

  function toggle(category: DesireCategory) {
    setChoices((current) => {
      const next = { ...current };
      if (next[category] === step.level) delete next[category];
      else next[category] = step.level;
      return next;
    });
  }

  async function save() {
    setStatus("saving");
    setError(null);

    const desires = SIMPLE_PREFERENCE_CATEGORIES.flatMap((category) => {
      const level = choices[category];
      if (!level) return [];
      return [{ category, level, privacy: level === "hard_limit" || !showOnProfile ? "private" : "public" }];
    });

    const response = await fetch("/api/desires", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ desires }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus("idle");
      setError(body?.error ?? "We couldn't save your preferences. Try again.");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1.5" aria-label={`Step ${activeIndex + 1} of ${STEPS.length}`}>
          {STEPS.map((item, index) => (
            <span
              key={item.id}
              className={cn("h-1.5 w-10 rounded-full", index <= activeIndex ? "bg-foreground" : "bg-muted")}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
      </div>

      <div className="mt-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Step {activeIndex + 1} of {STEPS.length}
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:text-3xl">{step.title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{step.description}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3">
        {SIMPLE_PREFERENCE_CATEGORIES.map((category) => {
          const selected = choices[category] === step.level;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(category)}
              className={cn(
                "flex min-h-16 items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:bg-muted"
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{getPreferenceLabel(category)}</span>
                <span className={cn("mt-0.5 hidden text-[11px] leading-4 sm:block", selected ? "text-background/70" : "text-muted-foreground")}>
                  {getPreferenceDescription(category)}
                </span>
              </span>
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-background/30" : "border-border"
                )}
              >
                {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>

      {activeIndex === STEPS.length - 1 && (
        <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
          <div className="flex items-start gap-3 p-4">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Private by default</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Your choices shape recommendations. Boundaries are never displayed publicly.
              </p>
            </div>
          </div>
          <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 p-4">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Show positive choices on my profile
            </span>
            <Switch checked={showOnProfile} onCheckedChange={setShowOnProfile} />
          </label>
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-10 mt-7 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/95 p-2 shadow-lift backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <Button
          type="button"
          variant="ghost"
          className="h-11"
          disabled={activeIndex === 0 || status === "saving"}
          onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Button>

        {activeIndex < STEPS.length - 1 ? (
          <Button type="button" className="h-11 min-w-28" onClick={() => setActiveIndex((index) => index + 1)}>
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="button" className="h-11 min-w-36" disabled={status === "saving"} onClick={save}>
            {status === "saving" ? "Saving..." : submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
