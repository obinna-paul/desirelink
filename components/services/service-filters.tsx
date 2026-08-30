"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORY_OPTIONS } from "@/lib/account-types";
import {
  SERVICE_RADIUS_OPTIONS,
  SERVICE_SORT_OPTIONS,
  type ServiceFilters,
  type ServiceSortValue,
} from "@/lib/service-listings";

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
          : "border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function ServiceFiltersPanel({ initialFilters }: { initialFilters: ServiceFilters }) {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>(initialFilters.categories);
  const [minPrice, setMinPrice] = useState(
    initialFilters.minPriceCents !== null ? String(initialFilters.minPriceCents / 100) : ""
  );
  const [maxPrice, setMaxPrice] = useState(
    initialFilters.maxPriceCents !== null ? String(initialFilters.maxPriceCents / 100) : ""
  );
  const [city, setCity] = useState(initialFilters.city);
  const [radiusKm, setRadiusKm] = useState<string>(
    initialFilters.radiusKm === null ? "any" : String(initialFilters.radiusKm)
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
    (verifiedOnly ? 0 : 1) +
    (sort !== "newest" ? 1 : 0);

  function applyFilters() {
    const params = new URLSearchParams();
    categories.forEach((value) => params.append("category", value));
    if (minPrice.trim()) params.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim());
    if (city.trim()) params.set("city", city.trim());
    params.set("radius", radiusKm);
    params.set("verified", verifiedOnly ? "true" : "false");
    params.set("sort", sort);
    router.push(`/services?${params.toString()}`);
    setOpen(false);
  }

  function clearFilters() {
    setCategories([]);
    setMinPrice("");
    setMaxPrice("");
    setCity("");
    setRadiusKm("any");
    setVerifiedOnly(true);
    setSort("newest");
    router.push("/services");
    setOpen(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm md:rounded-xl md:shadow-none">
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

      <div className={cn("flex-col gap-5 border-t border-border p-4 md:flex md:border-t-0", open ? "flex" : "hidden")}>
        <div className="hidden text-sm font-semibold md:block">Filters</div>
        <FilterSection title="Category">
          <div className="flex flex-wrap gap-2">
            {SERVICE_CATEGORY_OPTIONS.map((option) => (
              <ToggleChip
                key={option}
                label={option}
                pressed={categories.includes(option)}
                onClick={() => setCategories((prev) => toggleValue(prev, option))}
              />
            ))}
          </div>
        </FilterSection>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSection title="Min price (NGN)">
            <Input
              aria-label="Minimum price"
              type="number"
              min={0}
              placeholder="Any"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="h-11 text-sm"
            />
          </FilterSection>

          <FilterSection title="Max price (NGN)">
            <Input
              aria-label="Maximum price"
              type="number"
              min={0}
              placeholder="Any"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-11 text-sm"
            />
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
              {SERVICE_RADIUS_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  Within {km} km
                </option>
              ))}
            </Select>
          </FilterSection>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSection title="Sort by">
            <Select
              aria-label="Sort by"
              value={sort}
              onChange={(e) => setSort(e.target.value as ServiceSortValue)}
              className="h-11 text-sm"
            >
              {SERVICE_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FilterSection>

          <FilterSection title="Verified providers only">
            <label className="flex min-h-11 cursor-pointer items-center gap-2">
              <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
              <span className="text-sm text-muted-foreground">{verifiedOnly ? "On" : "Off"}</span>
            </label>
          </FilterSection>
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
