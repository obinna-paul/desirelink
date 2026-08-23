"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DesireLevel } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { GENDER_OPTIONS, ORIENTATION_OPTIONS } from "@/lib/profile-options";
import { DESIRE_CATEGORIES } from "@/lib/desire-options";
import {
  AVAILABILITY_FILTER_OPTIONS,
  CREATOR_FILTER_OPTIONS,
  DEFAULT_RADIUS_KM,
  DESIRE_LEVEL_FILTER_OPTIONS,
  DISCOVER_SORT_OPTIONS,
  RADIUS_OPTIONS,
  RELATIONSHIP_OPTIONS,
  type AvailabilityFilterValue,
  type CreatorFilterValue,
  type DiscoverFilters,
  type DiscoverSortValue,
  type RelationshipValue,
} from "@/lib/discover";

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
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
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

export function DiscoverFiltersPanel({ initialFilters }: { initialFilters: DiscoverFilters }) {
  const router = useRouter();
  const [genders, setGenders] = useState<string[]>(initialFilters.genders);
  const [orientations, setOrientations] = useState<string[]>(initialFilters.orientations);
  const [relationship, setRelationship] = useState<RelationshipValue[]>(initialFilters.relationship);
  const [desireCategories, setDesireCategories] = useState<string[]>(initialFilters.desireCategories);
  const [desireLevel, setDesireLevel] = useState<DesireLevel | "">(initialFilters.desireLevel ?? "");
  const [radiusKm, setRadiusKm] = useState<string>(
    initialFilters.radiusKm === null ? "any" : String(initialFilters.radiusKm)
  );
  const [creator, setCreator] = useState<CreatorFilterValue>(initialFilters.creator);
  const [availability, setAvailability] = useState<AvailabilityFilterValue>(
    initialFilters.availability
  );
  const [sort, setSort] = useState<DiscoverSortValue>(initialFilters.sort);

  function applyFilters() {
    const params = new URLSearchParams();
    genders.forEach((value) => params.append("gender", value));
    orientations.forEach((value) => params.append("orientation", value));
    relationship.forEach((value) => params.append("relationship", value));
    desireCategories.forEach((value) => params.append("desire", value));
    if (desireLevel) params.set("desireLevel", desireLevel);
    params.set("radius", radiusKm);
    params.set("creator", creator);
    params.set("availability", availability);
    params.set("sort", sort);
    router.push(`/discover?${params.toString()}`);
  }

  function clearFilters() {
    setGenders([]);
    setOrientations([]);
    setRelationship([]);
    setDesireCategories([]);
    setDesireLevel("");
    setRadiusKm(String(DEFAULT_RADIUS_KM));
    setCreator("any");
    setAvailability("any");
    setSort("newest");
    router.push("/discover");
  }

  return (
    <details open className="rounded-xl border border-border/60 bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Filters
      </summary>

      <div className="flex flex-col gap-5 border-t border-border/60 p-4">
        <FilterSection title="Gender">
          <div className="flex flex-wrap gap-2">
            {GENDER_OPTIONS.map((option) => (
              <ToggleChip
                key={option}
                label={option}
                pressed={genders.includes(option)}
                onClick={() => setGenders((prev) => toggleValue(prev, option))}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Orientation">
          <div className="flex flex-wrap gap-2">
            {ORIENTATION_OPTIONS.map((option) => (
              <ToggleChip
                key={option}
                label={option}
                pressed={orientations.includes(option)}
                onClick={() => setOrientations((prev) => toggleValue(prev, option))}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Relationship type">
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIP_OPTIONS.map((option) => (
              <ToggleChip
                key={option.value}
                label={option.label}
                pressed={relationship.includes(option.value)}
                onClick={() => setRelationship((prev) => toggleValue(prev, option.value))}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Desires">
          <div className="flex flex-wrap gap-2">
            {DESIRE_CATEGORIES.map((category) => (
              <ToggleChip
                key={category}
                label={category}
                pressed={desireCategories.includes(category)}
                onClick={() => setDesireCategories((prev) => toggleValue(prev, category))}
              />
            ))}
          </div>
          <Select
            aria-label="Desire level"
            value={desireLevel}
            onChange={(event) => setDesireLevel(event.target.value as DesireLevel | "")}
            className="mt-1 h-9 w-full text-sm sm:w-64"
          >
            <option value="">Any level</option>
            {DESIRE_LEVEL_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FilterSection>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSection title="Location radius">
            <Select
              aria-label="Location radius"
              value={radiusKm}
              onChange={(event) => setRadiusKm(event.target.value)}
              className="h-9 text-sm"
            >
              {RADIUS_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  Within {km} km
                </option>
              ))}
              <option value="any">Any distance</option>
            </Select>
          </FilterSection>

          <FilterSection title="Creator status">
            <Select
              aria-label="Creator status"
              value={creator}
              onChange={(event) => setCreator(event.target.value as CreatorFilterValue)}
              className="h-9 text-sm"
            >
              {CREATOR_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FilterSection>

          <FilterSection title="Availability">
            <Select
              aria-label="Availability status"
              value={availability}
              onChange={(event) => setAvailability(event.target.value as AvailabilityFilterValue)}
              className="h-9 text-sm"
            >
              {AVAILABILITY_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FilterSection>

          <FilterSection title="Sort by">
            <Select
              aria-label="Sort by"
              value={sort}
              onChange={(event) => setSort(event.target.value as DiscoverSortValue)}
              className="h-9 text-sm"
            >
              {DISCOVER_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FilterSection>
        </div>

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
