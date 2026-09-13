"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { MEN_GENDER_VALUES, WOMEN_GENDER_VALUES } from "@/lib/profile-options";
import { cn } from "@/lib/utils";

type Preset = "all" | "men" | "women";

function sameValues(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((value) => bSet.has(value));
}

function presetFor(genders: string[]): Preset {
  if (sameValues(genders, MEN_GENDER_VALUES)) return "men";
  if (sameValues(genders, WOMEN_GENDER_VALUES)) return "women";
  return "all";
}

const OPTIONS: { key: Preset; label: string; values: string[] }[] = [
  { key: "all", label: "All", values: [] },
  { key: "men", label: "Men", values: MEN_GENDER_VALUES },
  { key: "women", label: "Women", values: WOMEN_GENDER_VALUES },
];

/** A quick, one-tap Men/Women/All toggle sitting alongside the search bar - distinct from
 * the full gender-identity multi-select buried in the filters drawer (DiscoverFiltersPanel),
 * which stays untouched for anyone who wants finer-grained control. Only ever touches the
 * `gender` query param; every other active filter (query, radius, sort, ...) is preserved
 * as-is. */
export function DiscoverGenderQuickFilter({ initialGenders }: { initialGenders: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = presetFor(initialGenders);

  function select(option: (typeof OPTIONS)[number]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("gender");
    option.values.forEach((value) => params.append("gender", value));
    const query = params.toString();
    router.push(query ? `/discover?${query}` : "/discover");
  }

  return (
    <div role="radiogroup" aria-label="Filter by gender" className="flex gap-1 rounded-full bg-muted p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          role="radio"
          aria-checked={active === option.key}
          onClick={() => select(option)}
          className={cn(
            "min-h-9 flex-1 rounded-full px-4 text-xs font-semibold transition-colors sm:flex-none",
            active === option.key ? "bg-card text-primary shadow-card" : "text-muted-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
