"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  MentionSuggestionMenu,
  useMentionSuggestions,
  type MentionSuggestion,
} from "@/components/mentions/mention-suggestions";
import { getActiveMention, replaceActiveMention, type ActiveMention } from "@/lib/mentions";
import { cn } from "@/lib/utils";

export const MentionInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onValueChange: (value: string) => void;
    placeholder: string;
    maxLength?: number;
    className?: string;
    placement?: "top" | "bottom";
    ariaLabel?: string;
  }
>(function MentionInput(
  {
    value,
    onValueChange,
    placeholder,
    maxLength = 1000,
    className,
    placement = "bottom",
    ariaLabel,
  },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const nextCaretRef = useRef<number | null>(null);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const { suggestions, loading, setSuggestions } = useMentionSuggestions(activeMention?.query);

  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    if (nextCaretRef.current === null) return;
    const caret = nextCaretRef.current;
    nextCaretRef.current = null;
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(caret, caret);
  }, [value]);

  function updateActive(nextValue: string, caret: number) {
    setActiveMention(getActiveMention(nextValue, caret));
    setHighlightedIndex(0);
  }

  function chooseSuggestion(suggestion: MentionSuggestion) {
    if (!activeMention) return;
    const replacement = replaceActiveMention(value, activeMention, suggestion.username);
    nextCaretRef.current = replacement.caret;
    onValueChange(replacement.value.slice(0, maxLength));
    setActiveMention(null);
    setSuggestions([]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!activeMention || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => (current === 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      chooseSuggestion(suggestions[highlightedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setActiveMention(null);
      setSuggestions([]);
    }
  }

  const menuOpen = Boolean(activeMention && activeMention.query.length > 0);

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          updateActive(event.target.value, event.target.selectionStart ?? event.target.value.length);
        }}
        onClick={(event) => updateActive(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)}
        onKeyUp={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) return;
          updateActive(event.currentTarget.value, event.currentTarget.selectionStart ?? 0);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(() => setActiveMention(null), 100)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? listboxId : undefined}
        aria-activedescendant={menuOpen && suggestions[highlightedIndex] ? `${listboxId}-${highlightedIndex}` : undefined}
        autoComplete="off"
        className={cn(
          "h-11 w-full rounded-full border border-border bg-muted px-4 text-sm outline-none transition-colors focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      />
      {menuOpen && (
        <MentionSuggestionMenu
          id={listboxId}
          suggestions={suggestions}
          loading={loading}
          highlightedIndex={highlightedIndex}
          onHighlight={setHighlightedIndex}
          onSelect={chooseSuggestion}
          placement={placement}
        />
      )}
    </div>
  );
});
