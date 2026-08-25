"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { DesireLevel } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/use-focus-trap";
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

type DropdownOption = { value: string; label: string };

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  footer,
}: {
  label: string;
  options: readonly DropdownOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, panelRef);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-sm transition-colors",
          selected.length > 0
            ? "border-primary/60 bg-secondary text-foreground"
            : "border-input bg-background text-muted-foreground hover:text-foreground"
        )}
      >
        <span className="truncate">
          {label}
          {selected.length > 0 && <span className="text-foreground"> &middot; {selected.length}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border/60 bg-card p-2 shadow-lg focus:outline-none"
        >
          <ul className="flex flex-col">
            {options.map((option) => (
              <li key={option.value}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => toggle(option.value)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  {option.label}
                </label>
              </li>
            ))}
          </ul>
          {footer && <div className="mt-2 border-t border-border/60 pt-2">{footer}</div>}
        </div>
      )}
    </div>
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

const toDropdownOptions = (values: readonly string[]): DropdownOption[] =>
  values.map((value) => ({ value, label: value }));

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

      <div className="flex flex-col gap-4 border-t border-border/60 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MultiSelectDropdown
            label="Gender"
            options={toDropdownOptions(GENDER_OPTIONS)}
            selected={genders}
            onChange={setGenders}
          />
          <MultiSelectDropdown
            label="Orientation"
            options={toDropdownOptions(ORIENTATION_OPTIONS)}
            selected={orientations}
            onChange={setOrientations}
          />
          <MultiSelectDropdown
            label="Relationship type"
            options={RELATIONSHIP_OPTIONS}
            selected={relationship}
            onChange={(next) => setRelationship(next as RelationshipValue[])}
          />
          <MultiSelectDropdown
            label="Desires"
            options={toDropdownOptions(DESIRE_CATEGORIES)}
            selected={desireCategories}
            onChange={setDesireCategories}
            footer={
              <Select
                aria-label="Desire level"
                value={desireLevel}
                onChange={(event) => setDesireLevel(event.target.value as DesireLevel | "")}
                className="h-10 w-full text-xs"
              >
                <option value="">Any level</option>
                {DESIRE_LEVEL_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSection title="Location radius">
            <Select
              aria-label="Location radius"
              value={radiusKm}
              onChange={(event) => setRadiusKm(event.target.value)}
              className="h-11 text-sm"
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
              className="h-11 text-sm"
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
              className="h-11 text-sm"
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
              className="h-11 text-sm"
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
