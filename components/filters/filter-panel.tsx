"use client";

import { useId } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/utils";

export function FilterPanel({
  open,
  onOpenChange,
  activeCount,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panelId = useId();

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-auto",
          open && "border-foreground/20 bg-accent",
        )}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filters
        {activeCount > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-[11px] font-bold leading-none text-background">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <section
          id={panelId}
          aria-label={title}
          className="mt-3 overflow-visible rounded-xl border border-border bg-card shadow-card"
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 md:px-5">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground">{title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
                {description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close filters"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>
          <div className="p-4 md:p-5">{children}</div>
        </section>
      )}
    </div>
  );
}

export function FilterGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="text-sm font-bold text-foreground">{title}</legend>
      {description && (
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </fieldset>
  );
}

export function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const Label = htmlFor ? "label" : "div";

  return (
    <div className="min-w-0">
      <Label
        {...(htmlFor ? { htmlFor } : {})}
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
