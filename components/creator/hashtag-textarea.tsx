"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AtSign, Hash, Loader2, TrendingUp } from "lucide-react";

import {
  MentionSuggestionMenu,
  useMentionSuggestions,
  type MentionSuggestion,
} from "@/components/mentions/mention-suggestions";
import { Textarea } from "@/components/ui/textarea";
import {
  getActiveHashtag,
  replaceActiveHashtag,
  type ActiveHashtag,
} from "@/lib/hashtag-input";
import {
  getActiveMention,
  replaceActiveMention,
  type ActiveMention,
} from "@/lib/mentions";
import { cn } from "@/lib/utils";

type HashtagSuggestion = {
  tag: string;
  postCount: number;
};

export function HashtagTextarea({
  id,
  value,
  onValueChange,
  onContentEdited,
  maxLength = 2000,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  onContentEdited?: () => void;
  maxLength?: number;
}) {
  const listboxId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextCaretRef = useRef<number | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<ActiveHashtag | null>(null);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [suggestions, setSuggestions] = useState<HashtagSuggestion[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const activeQuery = activeHashtag?.query;
  const {
    suggestions: mentionSuggestions,
    loading: mentionLoading,
    setSuggestions: setMentionSuggestions,
  } = useMentionSuggestions(activeMention?.query);

  const updateActiveToken = useCallback((nextValue: string, caret: number) => {
    const hashtag = getActiveHashtag(nextValue, caret);
    const mention = getActiveMention(nextValue, caret);
    if (mention && (!hashtag || mention.start >= hashtag.start)) {
      setActiveMention(mention);
      setActiveHashtag(null);
    } else {
      setActiveHashtag(hashtag);
      setActiveMention(null);
    }
    setHighlightedIndex(0);
  }, []);

  useEffect(() => {
    if (nextCaretRef.current === null) return;
    const caret = nextCaretRef.current;
    nextCaretRef.current = null;
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(caret, caret);
    updateActiveToken(value, caret);
  }, [updateActiveToken, value]);

  useEffect(() => {
    if (activeQuery === undefined) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/hashtags/suggestions?q=${encodeURIComponent(activeQuery ?? "")}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Suggestion request failed");
        const body = (await response.json()) as { suggestions?: HashtagSuggestion[] };
        setSuggestions(body.suggestions ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeQuery]);

  function chooseSuggestion(suggestion: HashtagSuggestion) {
    if (!activeHashtag) return;
    const replacement = replaceActiveHashtag(value, activeHashtag, suggestion.tag);
    nextCaretRef.current = replacement.caret;
    onValueChange(replacement.value.slice(0, maxLength));
    onContentEdited?.();
    setActiveHashtag(null);
    setSuggestions([]);
  }

  function chooseMention(suggestion: MentionSuggestion) {
    if (!activeMention) return;
    const replacement = replaceActiveMention(value, activeMention, suggestion.username);
    nextCaretRef.current = replacement.caret;
    onValueChange(replacement.value.slice(0, maxLength));
    onContentEdited?.();
    setActiveMention(null);
    setMentionSuggestions([]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const activeSuggestions = activeMention ? mentionSuggestions : suggestions;
    if ((!activeHashtag && !activeMention) || activeSuggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % activeSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current === 0 ? activeSuggestions.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      if (activeMention) chooseMention(mentionSuggestions[highlightedIndex]);
      else chooseSuggestion(suggestions[highlightedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setActiveHashtag(null);
      setActiveMention(null);
      setSuggestions([]);
      setMentionSuggestions([]);
    }
  }

  function insertHashtag() {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const needsSpace = start > 0 && !/\s/.test(value[start - 1] ?? "");
    const insertion = `${needsSpace ? " " : ""}#`;
    const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`.slice(
      0,
      maxLength,
    );
    const caret = Math.min(start + insertion.length, nextValue.length);
    nextCaretRef.current = caret;
    onValueChange(nextValue);
    onContentEdited?.();
  }

  function insertMention() {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const needsSpace = start > 0 && !/\s/.test(value[start - 1] ?? "");
    const insertion = `${needsSpace ? " " : ""}@`;
    const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`.slice(0, maxLength);
    const caret = Math.min(start + insertion.length, nextValue.length);
    nextCaretRef.current = caret;
    onValueChange(nextValue);
    onContentEdited?.();
  }

  const hashtagMenuOpen = Boolean(activeHashtag && (loading || suggestions.length > 0));
  const mentionMenuOpen = Boolean(activeMention && activeMention.query.length > 0);
  const menuOpen = hashtagMenuOpen || mentionMenuOpen;

  return (
    <div className="relative mt-2">
      <Textarea
        ref={textareaRef}
        id={id}
        rows={4}
        maxLength={maxLength}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? listboxId : undefined}
        aria-activedescendant={
          menuOpen && suggestions[highlightedIndex]
            ? `${listboxId}-${highlightedIndex}`
            : undefined
        }
        onChange={(event) => {
          onValueChange(event.target.value);
          onContentEdited?.();
          updateActiveToken(event.target.value, event.target.selectionStart);
        }}
        onClick={(event) =>
          updateActiveToken(event.currentTarget.value, event.currentTarget.selectionStart)
        }
        onBlur={() => {
          window.setTimeout(() => {
            setActiveHashtag(null);
            setActiveMention(null);
          }, 100);
        }}
        onKeyUp={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) return;
          updateActiveToken(event.currentTarget.value, event.currentTarget.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        className="min-h-28 resize-none rounded-[8px] border-border/80 bg-background/45 px-3.5 py-3 text-base leading-6 shadow-none focus-visible:bg-card md:text-sm"
      />

      {mentionMenuOpen && (
        <MentionSuggestionMenu
          id={listboxId}
          suggestions={mentionSuggestions}
          loading={mentionLoading}
          highlightedIndex={highlightedIndex}
          onHighlight={setHighlightedIndex}
          onSelect={chooseMention}
        />
      )}

      {hashtagMenuOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={activeHashtag?.query ? "Matching hashtags" : "Popular hashtags"}
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-[8px] border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          <div className="flex h-8 items-center gap-2 px-2.5 text-[11px] font-semibold uppercase text-muted-foreground">
            {activeHashtag?.query ? (
              <Hash className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {activeHashtag?.query ? "Suggestions" : "Popular now"}
            {loading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          </div>
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.tag}
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === highlightedIndex}
              onPointerDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => chooseSuggestion(suggestion)}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-[6px] px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === highlightedIndex && "bg-muted",
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                <Hash className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">#{suggestion.tag}</span>
                <span className="block text-xs text-muted-foreground">
                  {suggestion.postCount.toLocaleString()} {suggestion.postCount === 1 ? "post" : "posts"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex min-h-11 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={insertMention}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[6px] px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
            Mention
          </button>
          <button
            type="button"
            onClick={insertHashtag}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[6px] px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Hash className="h-3.5 w-3.5" aria-hidden="true" />
            Hashtag
          </button>
        </div>
        {value.length > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
