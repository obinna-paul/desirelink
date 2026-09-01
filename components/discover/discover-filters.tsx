"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { GENDER_OPTIONS, ORIENTATION_OPTIONS } from "@/lib/profile-options";
import {
  AVAILABILITY_FILTER_OPTIONS,
  BODY_TYPE_FILTER_OPTIONS,
  DEFAULT_RADIUS_KM,
  DISCOVER_SORT_OPTIONS,
  LAST_ACTIVE_FILTER_OPTIONS,
  RADIUS_OPTIONS,
  VERIFICATION_FILTER_OPTIONS,
  type AvailabilityFilterValue,
  type DiscoverFilters,
  type DiscoverSortValue,
  type LastActiveFilterValue,
  type VerificationFilterValue,
} from "@/lib/discover";

type DropdownOption = { value: string; label: string };

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  footer,
  disabled = false,
}: {
  label: string;
  options: readonly DropdownOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  footer?: React.ReactNode;
  disabled?: boolean;
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
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-sm transition-colors",
          disabled && "cursor-not-allowed opacity-55",
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

export function DiscoverFiltersPanel({
  initialFilters,
}: {
  initialFilters: DiscoverFilters;
}) {
  const router = useRouter();
  const [genders, setGenders] = useState<string[]>(initialFilters.genders);
  const [orientations, setOrientations] = useState<string[]>(initialFilters.orientations);
  const [bodyTypes, setBodyTypes] = useState<string[]>(initialFilters.bodyTypes);
  const [lastActive, setLastActive] = useState<LastActiveFilterValue>(initialFilters.lastActive);
  const [verification, setVerification] = useState<VerificationFilterValue>(initialFilters.verification);
  const [radiusKm, setRadiusKm] = useState<string>(
    initialFilters.radiusKm === null ? "any" : String(initialFilters.radiusKm)
  );
  const [availability, setAvailability] = useState<AvailabilityFilterValue>(
    initialFilters.availability
  );
  const [sort, setSort] = useState<DiscoverSortValue>(initialFilters.sort);
  const [open, setOpen] = useState(false);

  const activeFilterCount =
    genders.length +
    orientations.length +
    (radiusKm !== String(DEFAULT_RADIUS_KM) ? 1 : 0) +
    (availability !== "any" ? 1 : 0) +
    (sort !== "newest" ? 1 : 0) +
    bodyTypes.length +
    (lastActive !== "any" ? 1 : 0) +
    (verification !== "any" ? 1 : 0);

  function applyFilters() {
    const params = new URLSearchParams();
    if (initialFilters.query) params.set("q", initialFilters.query);
    genders.forEach((value) => params.append("gender", value));
    orientations.forEach((value) => params.append("orientation", value));
    bodyTypes.forEach((value) => params.append("bodyType", value));
    if (lastActive !== "any") params.set("lastActive", lastActive);
    if (verification !== "any") params.set("verification", verification);
    params.set("radius", radiusKm);
    params.set("availability", availability);
    params.set("sort", sort);
    router.push(`/discover?${params.toString()}`);
    setOpen(false);
  }

  function clearFilters() {
    setGenders([]);
    setOrientations([]);
    setBodyTypes([]);
    setLastActive("any");
    setVerification("any");
    setRadiusKm(String(DEFAULT_RADIUS_KM));
    setAvailability("any");
    setSort("newest");
    router.push("/discover");
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

      <div
        className={cn(
          "flex-col gap-4 border-t border-border/60 p-4 md:flex md:border-t-0",
          open ? "flex" : "hidden"
        )}
      >
        <div className="hidden px-0 text-sm font-semibold md:block">Filters</div>
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
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

        <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Advanced filters
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MultiSelectDropdown
              label="Body type"
              options={toDropdownOptions(BODY_TYPE_FILTER_OPTIONS)}
              selected={bodyTypes}
              onChange={setBodyTypes}
            />
            <FilterSection title="Last active">
              <Select
                aria-label="Last active"
                value={lastActive}
                onChange={(event) => setLastActive(event.target.value as LastActiveFilterValue)}
                className="h-11 text-sm"
              >
                {LAST_ACTIVE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FilterSection>
            <FilterSection title="Verification">
              <Select
                aria-label="Verification status"
                value={verification}
                onChange={(event) => setVerification(event.target.value as VerificationFilterValue)}
                className="h-11 text-sm"
              >
                {VERIFICATION_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FilterSection>
          </div>
        </div>

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
