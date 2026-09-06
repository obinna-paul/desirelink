"use client";

import { useEffect, useRef, useState } from "react";
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
    <div ref={containerRef} className="relative w-full sm:max-w-sm">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search people"
          aria-label="Search by username or display name"
          autoComplete="off"
          className="h-11 w-full rounded-full border border-input bg-background pl-9 pr-9 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:text-sm"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={handleClear}
            className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.username}>
              <Link
                href={`/profile/${suggestion.username}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
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
        </ul>
      )}
    </div>
  );
}
