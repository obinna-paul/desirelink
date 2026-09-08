"use client";

import { useEffect, useState } from "react";
import { AtSign, Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type MentionSuggestion = {
  username: string;
  displayName: string;
  avatarUrl: string;
};

export function useMentionSuggestions(query: string | undefined) {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query === undefined || query.length === 0) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/discover/suggest?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Mention suggestions failed");
        const body = (await response.json()) as { results?: MentionSuggestion[] };
        if (!controller.signal.aborted) setSuggestions(body.results ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { suggestions, loading, setSuggestions };
}

export function MentionSuggestionMenu({
  id,
  suggestions,
  loading,
  highlightedIndex,
  onHighlight,
  onSelect,
  placement = "bottom",
}: {
  id: string;
  suggestions: MentionSuggestion[];
  loading: boolean;
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (suggestion: MentionSuggestion) => void;
  placement?: "top" | "bottom";
}) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label="Matching people"
      className={cn(
        "absolute inset-x-0 z-40 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg",
        placement === "top" ? "bottom-full mb-2" : "top-full mt-1.5",
      )}
    >
      <div className="flex h-8 items-center gap-2 px-2.5 text-[11px] font-semibold uppercase text-muted-foreground">
        <AtSign className="h-3.5 w-3.5" aria-hidden="true" /> People
        {loading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      </div>
      {!loading && suggestions.length === 0 && (
        <p className="px-3 py-2.5 text-sm text-muted-foreground">No matching username found.</p>
      )}
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.username}
          id={`${id}-${index}`}
          type="button"
          role="option"
          aria-selected={index === highlightedIndex}
          onPointerDown={(event) => event.preventDefault()}
          onMouseEnter={() => onHighlight(index)}
          onClick={() => onSelect(suggestion)}
          className={cn(
            "flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            index === highlightedIndex && "bg-muted",
          )}
        >
          <Avatar className="h-8 w-8 shrink-0 border border-border">
            <AvatarImage src={suggestion.avatarUrl} alt="" />
            <AvatarFallback className="text-[11px]">
              {suggestion.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{suggestion.displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">@{suggestion.username}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
