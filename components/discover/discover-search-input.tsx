"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ProfileSuggestion } from "@/lib/discover";

const DEBOUNCE_MS = 200;

export function DiscoverSearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const inputId = useId();

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/discover/suggest?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: ProfileSuggestion[] }) => {
          setSuggestions(data.results ?? []);
          setOpen(true);
          setHighlighted(-1);
        })
        .catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function navigateToQuery(query: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
    const queryString = params.toString();
    router.push(queryString ? `/discover?${queryString}` : "/discover");
    setOpen(false);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (highlighted >= 0 && suggestions[highlighted]) {
      router.push(`/profile/${suggestions[highlighted].username}`);
      setOpen(false);
      return;
    }
    navigateToQuery(value.trim());
  }

  function handleClear() {
    setValue("");
    setSuggestions([]);
    setOpen(false);
    navigateToQuery("");
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full sm:max-w-md">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.trim() && setOpen(true)}
          placeholder="Search Udala"
          aria-label="Search people, posts, hashtags, and services"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={highlighted >= 0 ? `${inputId}-option-${highlighted}` : undefined}
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-12 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={handleClear}
            className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {open && value.trim() && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="People suggestions"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          {suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground" role="presentation">
              No matching people yet.
            </li>
          )}
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.username} role="presentation">
              <Link
                id={`${inputId}-option-${index}`}
                role="option"
                aria-selected={index === highlighted}
                href={`/profile/${suggestion.username}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  index === highlighted ? "bg-accent" : "hover:bg-accent",
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={suggestion.avatarUrl} alt="" />
                  <AvatarFallback>{suggestion.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{suggestion.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">@{suggestion.username}</p>
                </div>
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-border pt-1" role="presentation">
            <button
              type="button"
              onClick={() => navigateToQuery(value.trim())}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">See all results for &ldquo;{value.trim()}&rdquo;</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
