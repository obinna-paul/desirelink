"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { FilterField, FilterGroup, FilterPanel } from "@/components/filters/filter-panel";
import {
  FilterMultiSelect,
  FilterSelect,
  type FilterOption,
} from "@/components/filters/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SERVICE_CATEGORY_OPTIONS } from "@/lib/account-types";
import {
  SERVICE_RADIUS_OPTIONS,
  SERVICE_SORT_OPTIONS,
  type ServiceFilters,
  type ServiceSortValue,
} from "@/lib/service-listings";

const categoryOptions: FilterOption[] = SERVICE_CATEGORY_OPTIONS.map((category) => ({
  value: category,
  label: category,
}));

const radiusOptions: FilterOption[] = [
  { value: "any", label: "Any distance" },
  ...SERVICE_RADIUS_OPTIONS.map((km) => ({ value: String(km), label: `Within ${km} km` })),
];

export function ServiceFiltersPanel({ initialFilters }: { initialFilters: ServiceFilters }) {
  const router = useRouter();
  const verifiedId = useId();
  const minPriceId = useId();
  const maxPriceId = useId();
  const cityId = useId();
  const [categories, setCategories] = useState<string[]>(initialFilters.categories);
  const [minPrice, setMinPrice] = useState(
    initialFilters.minPriceCents !== null ? String(initialFilters.minPriceCents / 100) : "",
  );
  const [maxPrice, setMaxPrice] = useState(
    initialFilters.maxPriceCents !== null ? String(initialFilters.maxPriceCents / 100) : "",
  );
  const [city, setCity] = useState(initialFilters.city);
  const [radiusKm, setRadiusKm] = useState<string>(
    initialFilters.radiusKm === null ? "any" : String(initialFilters.radiusKm),
  );
  const [verifiedOnly, setVerifiedOnly] = useState(initialFilters.verifiedOnly);
  const [sort, setSort] = useState<ServiceSortValue>(initialFilters.sort);
  const [open, setOpen] = useState(false);

  const activeFilterCount =
    categories.length +
    (minPrice.trim() ? 1 : 0) +
    (maxPrice.trim() ? 1 : 0) +
    (city.trim() ? 1 : 0) +
    (radiusKm !== "any" ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (sort !== "newest" ? 1 : 0);

  function applyFilters() {
    const params = new URLSearchParams();
    categories.forEach((value) => params.append("category", value));
    if (minPrice.trim()) params.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim());
    if (city.trim()) params.set("city", city.trim());
    if (radiusKm !== "any") params.set("radius", radiusKm);
    if (verifiedOnly) params.set("verified", "true");
    if (sort !== "newest") params.set("sort", sort);
    const query = params.toString();
    router.push(query ? `/services?${query}` : "/services");
    setOpen(false);
  }

  function clearFilters() {
    setCategories([]);
    setMinPrice("");
    setMaxPrice("");
    setCity("");
    setRadiusKm("any");
    setVerifiedOnly(false);
    setSort("newest");
    router.push("/services");
    setOpen(false);
  }

  return (
    <FilterPanel
      open={open}
      onOpenChange={setOpen}
      activeCount={activeFilterCount}
      title="Service filters"
      description="Find listed services by category, price, provider location, and verified status."
    >
      <div className="flex flex-col gap-6">
        <FilterGroup title="Service" description="Choose the kind of listing and trust signals you need.">
          <FilterMultiSelect
            label="Categories"
            options={categoryOptions}
            selected={categories}
            onChange={setCategories}
          />
          <div className="min-w-0">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Verification</span>
            <label
              htmlFor={verifiedId}
              className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border border-input bg-background px-3.5"
            >
              <span className="text-sm text-foreground">Verified profiles only</span>
              <Switch id={verifiedId} checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
            </label>
          </div>
        </FilterGroup>

        <div className="border-t border-border" />

        <FilterGroup title="Price and location" description="Prices are listed in Nigerian naira.">
          <FilterField label="Minimum price" htmlFor={minPriceId}>
            <Input
              id={minPriceId}
              inputMode="decimal"
              type="number"
              min={0}
              placeholder="No minimum"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              className="h-12 rounded-lg px-3.5 text-sm"
            />
          </FilterField>
          <FilterField label="Maximum price" htmlFor={maxPriceId}>
            <Input
              id={maxPriceId}
              inputMode="decimal"
              type="number"
              min={0}
              placeholder="No maximum"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              className="h-12 rounded-lg px-3.5 text-sm"
            />
          </FilterField>
          <FilterField label="Provider city" htmlFor={cityId}>
            <Input
              id={cityId}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Any city"
              className="h-12 rounded-lg px-3.5 text-sm"
            />
          </FilterField>
          <FilterSelect
            label="Distance"
            value={radiusKm}
            options={radiusOptions}
            onChange={setRadiusKm}
          />
        </FilterGroup>

        <div className="border-t border-border" />

        <FilterGroup title="Results">
          <FilterSelect
            label="Sort by"
            value={sort}
            options={SERVICE_SORT_OPTIONS}
            onChange={(value) => setSort(value as ServiceSortValue)}
          />
        </FilterGroup>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Reset
          </Button>
          <Button type="button" onClick={applyFilters} className="sm:min-w-36">
            Show services
          </Button>
        </div>
      </div>
    </FilterPanel>
  );
}
