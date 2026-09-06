"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FilterGroup, FilterPanel } from "@/components/filters/filter-panel";
import {
  FilterMultiSelect,
  FilterSelect,
  type FilterOption,
} from "@/components/filters/filter-select";
import { Button } from "@/components/ui/button";
import { GENDER_OPTIONS, ORIENTATION_OPTIONS } from "@/lib/profile-options";
import {
  AVAILABILITY_FILTER_OPTIONS,
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

const toOptions = (values: readonly string[]): FilterOption[] =>
  values.map((value) => ({ value, label: value }));

const radiusOptions: FilterOption[] = [
  ...RADIUS_OPTIONS.map((km) => ({ value: String(km), label: `Within ${km} km` })),
  { value: "any", label: "Any distance" },
];

export function DiscoverFiltersPanel({
  initialFilters,
}: {
  initialFilters: DiscoverFilters;
}) {
  const router = useRouter();
  const [genders, setGenders] = useState<string[]>(initialFilters.genders);
  const [orientations, setOrientations] = useState<string[]>(initialFilters.orientations);
  const [lastActive, setLastActive] = useState<LastActiveFilterValue>(initialFilters.lastActive);
  const [verification, setVerification] = useState<VerificationFilterValue>(initialFilters.verification);
  const [radiusKm, setRadiusKm] = useState<string>(
    initialFilters.radiusKm === null ? "any" : String(initialFilters.radiusKm),
  );
  const [availability, setAvailability] = useState<AvailabilityFilterValue>(
    initialFilters.availability,
  );
  const [sort, setSort] = useState<DiscoverSortValue>(initialFilters.sort);
  const [open, setOpen] = useState(false);

  const activeFilterCount =
    genders.length +
    orientations.length +
    (radiusKm !== String(DEFAULT_RADIUS_KM) ? 1 : 0) +
    (availability !== "any" ? 1 : 0) +
    (sort !== "newest" ? 1 : 0) +
    (lastActive !== "any" ? 1 : 0) +
    (verification !== "any" ? 1 : 0);

  function applyFilters() {
    const params = new URLSearchParams();
    if (initialFilters.query) params.set("q", initialFilters.query);
    genders.forEach((value) => params.append("gender", value));
    orientations.forEach((value) => params.append("orientation", value));
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
    setLastActive("any");
    setVerification("any");
    setRadiusKm(String(DEFAULT_RADIUS_KM));
    setAvailability("any");
    setSort("newest");
    router.push(initialFilters.query ? `/discover?q=${encodeURIComponent(initialFilters.query)}` : "/discover");
    setOpen(false);
  }

  return (
    <FilterPanel
      open={open}
      onOpenChange={setOpen}
      activeCount={activeFilterCount}
      title="Discover filters"
      description="Narrow the people you see using information they have chosen to add to Udala."
    >
      <div className="flex flex-col gap-6">
        <FilterGroup title="Profile" description="Use optional profile details to refine the people shown.">
          <FilterMultiSelect
            label="Gender"
            options={toOptions(GENDER_OPTIONS)}
            selected={genders}
            onChange={setGenders}
          />
          <FilterMultiSelect
            label="Orientation"
            options={toOptions(ORIENTATION_OPTIONS)}
            selected={orientations}
            onChange={setOrientations}
          />
          <FilterSelect
            label="Verification"
            value={verification}
            options={VERIFICATION_FILTER_OPTIONS}
            onChange={(value) => setVerification(value as VerificationFilterValue)}
          />
        </FilterGroup>

        <div className="border-t border-border" />

        <FilterGroup title="Location and activity" description="Location filters use saved profile coordinates, never biography text.">
          <FilterSelect
            label="Distance"
            value={radiusKm}
            options={radiusOptions}
            onChange={setRadiusKm}
          />
          <FilterSelect
            label="Availability"
            value={availability}
            options={AVAILABILITY_FILTER_OPTIONS}
            onChange={(value) => setAvailability(value as AvailabilityFilterValue)}
          />
          <FilterSelect
            label="Last active"
            value={lastActive}
            options={LAST_ACTIVE_FILTER_OPTIONS}
            onChange={(value) => setLastActive(value as LastActiveFilterValue)}
          />
        </FilterGroup>

        <div className="border-t border-border" />

        <FilterGroup title="Results">
          <FilterSelect
            label="Sort by"
            value={sort}
            options={DISCOVER_SORT_OPTIONS}
            onChange={(value) => setSort(value as DiscoverSortValue)}
          />
        </FilterGroup>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Reset
          </Button>
          <Button type="button" onClick={applyFilters} className="sm:min-w-36">
            Show results
          </Button>
        </div>
      </div>
    </FilterPanel>
  );
}
