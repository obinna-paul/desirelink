"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EVENT_DATE_PRESETS,
  EVENT_PRIVACY_FILTER_OPTIONS,
  EVENT_RADIUS_OPTIONS,
  EVENT_TYPE_OPTIONS,
  type EventDatePreset,
  type EventFilters,
  type EventPrivacyFilter,
} from "@/lib/events";

function ToggleChip({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-3 text-sm transition-colors",
        pressed
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border/60 bg-card text-muted-foreground hover:border-neon-pink/60 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function EventFiltersPanel({ initialFilters }: { initialFilters: EventFilters }) {
  const router = useRouter();
  const [types, setTypes] = useState<string[]>(initialFilters.types);
  const [datePreset, setDatePreset] = useState<EventDatePreset>(initialFilters.datePreset);
  const [customFrom, setCustomFrom] = useState(initialFilters.customFrom);
  const [customTo, setCustomTo] = useState(initialFilters.customTo);
  const [city, setCity] = useState(initialFilters.city);
  const [radiusKm, setRadiusKm] = useState<string>(
    initialFilters.radiusKm === null ? "any" : String(initialFilters.radiusKm)
  );
  const [privacy, setPrivacy] = useState<EventPrivacyFilter>(initialFilters.privacy);
  const [open, setOpen] = useState(false);

  const activeFilterCount =
    types.length +
    (datePreset !== "any" ? 1 : 0) +
    (city.trim() ? 1 : 0) +
    (radiusKm !== "any" ? 1 : 0) +
    (privacy !== "all" ? 1 : 0);

  function applyFilters() {
    const params = new URLSearchParams();
    types.forEach((value) => params.append("type", value));
    params.set("date", datePreset);
    if (datePreset === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    if (city.trim()) params.set("city", city.trim());
    params.set("radius", radiusKm);
    params.set("privacy", privacy);
    router.push(`/events?${params.toString()}`);
    setOpen(false);
  }

  function clearFilters() {
    setTypes([]);
    setDatePreset("any");
    setCustomFrom("");
    setCustomTo("");
    setCity("");
    setRadiusKm("any");
    setPrivacy("all");
    router.push("/events");
    setOpen(false);
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card shadow-sm md:rounded-xl md:shadow-none">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold md:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      <div className={cn("flex-col gap-5 border-t border-border/60 p-4 md:flex md:border-t-0", open ? "flex" : "hidden")}>
        <div className="hidden text-sm font-semibold md:block">Filters</div>
        <FilterSection title="Type">
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPE_OPTIONS.map((option) => (
              <ToggleChip
                key={option}
                label={option}
                pressed={types.includes(option)}
                onClick={() => setTypes((prev) => toggleValue(prev, option))}
              />
            ))}
          </div>
        </FilterSection>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSection title="Date">
            <Select
              aria-label="Date"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as EventDatePreset)}
              className="h-11 text-sm"
            >
              {EVENT_DATE_PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FilterSection>

          <FilterSection title="City">
            <Input
              aria-label="City"
              placeholder="Any city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-11 text-sm"
            />
          </FilterSection>

          <FilterSection title="Radius">
            <Select
              aria-label="Radius"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              className="h-11 text-sm"
            >
              <option value="any">Any distance</option>
              {EVENT_RADIUS_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  Within {km} km
                </option>
              ))}
            </Select>
          </FilterSection>

          <FilterSection title="Visibility">
            <Select
              aria-label="Visibility"
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as EventPrivacyFilter)}
              className="h-11 text-sm"
            >
              {EVENT_PRIVACY_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FilterSection>
        </div>

        {datePreset === "custom" && (
          <FilterSection title="Custom range">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                aria-label="From date"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-11 text-sm"
              />
              <Input
                aria-label="To date"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-11 text-sm"
              />
            </div>
          </FilterSection>
        )}

        <div className="flex gap-3">
          <Button type="button" onClick={applyFilters} className="flex-1 md:flex-none">
            Apply filters
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters} className="flex-1 md:flex-none">
            Clear all
          </Button>
        </div>
      </div>
    </section>
  );
}
