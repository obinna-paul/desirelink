"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CREATOR_DIRECTORY_SORT_OPTIONS,
  CREATOR_DIRECTORY_TIER_TYPE_OPTIONS,
  type CreatorDirectoryFilters,
  type CreatorDirectorySortValue,
} from "@/lib/creators-directory";

export function CreatorDirectoryFiltersPanel({
  initialFilters,
}: {
  initialFilters: CreatorDirectoryFilters;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialFilters.query);
  const [tierTypes, setTierTypes] = useState<string[]>(initialFilters.tierTypes);
  const [sort, setSort] = useState<CreatorDirectorySortValue>(initialFilters.sort);

  function toggleTierType(value: string) {
    setTierTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function applyFilters(event?: React.FormEvent) {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    tierTypes.forEach((value) => params.append("tierType", value));
    if (sort !== "newest") params.set("sort", sort);
    const qs = params.toString();
    router.push(qs ? `/creators?${qs}` : "/creators");
  }

  function clearFilters() {
    setQuery("");
    setTierTypes([]);
    setSort("newest");
    router.push("/creators");
  }

  const hasActiveFilters = query.trim() !== "" || tierTypes.length > 0 || sort !== "newest";

  return (
    <form
      onSubmit={applyFilters}
      className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-xl md:shadow-none"
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search creators by name or username"
          aria-label="Search creators"
          className="h-11 pl-9"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tier type</span>
          <div className="flex flex-wrap gap-2">
            {CREATOR_DIRECTORY_TIER_TYPE_OPTIONS.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleTierType(type)}
                className={cn(
                  "flex min-h-9 items-center rounded-full border px-3 text-xs font-medium capitalize transition-colors",
                  tierTypes.includes(type)
                    ? "border-primary/60 bg-secondary text-foreground"
                    : "border-input bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort by</span>
          <Select
            aria-label="Sort by"
            value={sort}
            onChange={(event) => setSort(event.target.value as CreatorDirectorySortValue)}
            className="h-11 text-sm"
          >
            {CREATOR_DIRECTORY_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" className="flex-1 sm:flex-none">
          Apply filters
        </Button>
        {hasActiveFilters && (
          <Button type="button" variant="outline" onClick={clearFilters} className="flex-1 sm:flex-none">
            Clear all
          </Button>
        )}
      </div>
    </form>
  );
}
