"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { FilterGroup, FilterPanel } from "@/components/filters/filter-panel";
import {
  FilterMultiSelect,
  FilterSelect,
  type FilterOption,
} from "@/components/filters/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CREATOR_DIRECTORY_SORT_OPTIONS,
  CREATOR_DIRECTORY_TIER_TYPE_OPTIONS,
  type CreatorDirectoryFilters,
  type CreatorDirectorySortValue,
} from "@/lib/creators-directory";
import { TIER_TYPE_LABELS } from "@/lib/validations/creator-tier";

const tierOptions: FilterOption[] = CREATOR_DIRECTORY_TIER_TYPE_OPTIONS.map((value) => ({
  value,
  label: TIER_TYPE_LABELS[value],
}));

export function CreatorDirectoryFiltersPanel({
  initialFilters,
}: {
  initialFilters: CreatorDirectoryFilters;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialFilters.query);
  const [tierTypes, setTierTypes] = useState<string[]>(initialFilters.tierTypes);
  const [sort, setSort] = useState<CreatorDirectorySortValue>(initialFilters.sort);
  const [open, setOpen] = useState(false);

  const activeFilterCount = tierTypes.length + (sort !== "newest" ? 1 : 0);

  function destination() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    tierTypes.forEach((value) => params.append("tierType", value));
    if (sort !== "newest") params.set("sort", sort);
    const search = params.toString();
    return search ? `/creators?${search}` : "/creators";
  }

  function applyFilters(event?: React.FormEvent) {
    event?.preventDefault();
    router.push(destination());
    setOpen(false);
  }

  function clearFilters() {
    setTierTypes([]);
    setSort("newest");
    const trimmedQuery = query.trim();
    router.push(trimmedQuery ? `/creators?q=${encodeURIComponent(trimmedQuery)}` : "/creators");
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={applyFilters} className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or username"
            aria-label="Search creators"
            className="h-12 rounded-lg bg-card pl-10"
          />
        </div>
        <Button type="submit" className="h-12 shrink-0 px-5">
          Search
        </Button>
      </form>

      <FilterPanel
        open={open}
        onOpenChange={setOpen}
        activeCount={activeFilterCount}
        title="Creator filters"
        description="Refine premium profiles using subscription options that are currently available."
      >
        <div className="flex flex-col gap-6">
          <FilterGroup title="Subscription and results">
            <FilterMultiSelect
              label="Subscription option"
              options={tierOptions}
              selected={tierTypes}
              onChange={setTierTypes}
            />
            <FilterSelect
              label="Sort by"
              value={sort}
              options={CREATOR_DIRECTORY_SORT_OPTIONS}
              onChange={(value) => setSort(value as CreatorDirectorySortValue)}
            />
          </FilterGroup>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={clearFilters}>
              Reset
            </Button>
            <Button type="button" onClick={() => applyFilters()} className="sm:min-w-36">
              Show creators
            </Button>
          </div>
        </div>
      </FilterPanel>
    </div>
  );
}
