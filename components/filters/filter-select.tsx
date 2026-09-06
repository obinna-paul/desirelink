"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/use-focus-trap";

export type FilterOption = {
  value: string;
  label: string;
};

function ChoiceMenu({
  open,
  onOpenChange,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, menuRef);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label={`Close ${label}`}
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[1px] md:hidden"
      />
      <div
        ref={menuRef}
        tabIndex={-1}
        className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[100] max-h-[min(68dvh,32rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none md:absolute md:inset-x-0 md:bottom-auto md:top-[calc(100%+0.5rem)] md:z-50 md:max-h-80 md:rounded-xl md:shadow-lg"
      >
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4">
          <p className="truncate text-sm font-bold text-foreground">{label}</p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={`Close ${label}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-input bg-background px-3.5 text-left text-sm text-foreground transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{selected?.label ?? "Select"}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      <ChoiceMenu open={open} onOpenChange={setOpen} label={label}>
        <div id={listboxId} role="listbox" aria-label={label} className="max-h-[calc(68dvh-3.5rem)] overflow-y-auto p-2 md:max-h-64">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isSelected ? "bg-accent font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </ChoiceMenu>
    </div>
  );
}

export function FilterMultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const summary =
    selected.length === 0
      ? "Any"
      : selected.length === 1
        ? options.find((option) => option.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} selected`;

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-input bg-background px-3.5 text-left text-sm text-foreground transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>{summary}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      <ChoiceMenu open={open} onOpenChange={setOpen} label={label}>
        <div id={listboxId} role="listbox" aria-multiselectable="true" aria-label={label} className="max-h-[calc(68dvh-7rem)] overflow-y-auto p-2 md:max-h-56">
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(option.value)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isSelected ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                    isSelected ? "border-foreground bg-foreground text-background" : "border-input bg-background",
                  )}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border p-3">
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
            className="min-h-11 px-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 rounded-full bg-foreground px-5 text-sm font-bold text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Done
          </button>
        </div>
      </ChoiceMenu>
    </div>
  );
}
