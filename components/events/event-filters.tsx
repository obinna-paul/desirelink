"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
          ? "border-transparent bg-gradient-to-r from-neon-pink to-neon-cyan text-background"
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
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
  }

  return (
    <details open className="rounded-xl border border-border/60 bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Filters
      </summary>

      <div className="flex flex-col gap-5 border-t border-border/60 p-4">
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
          <Button type="button" onClick={applyFilters}>
            Apply filters
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      </div>
    </details>
  );
}
