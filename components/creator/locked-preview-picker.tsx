"use client";

import { EyeOff, Image as ImageIcon } from "lucide-react";

import type { LockedPreviewMode } from "@/lib/post-shared";
import { cn } from "@/lib/utils";

const options: {
  value: LockedPreviewMode;
  label: string;
  helper: string;
  icon: typeof EyeOff;
}[] = [
  {
    value: "hidden",
    label: "Hide completely",
    helper: "Show a solid cover. Your photo or video stays completely hidden.",
    icon: EyeOff,
  },
  {
    value: "blurred",
    label: "Show blurred preview",
    helper: "Show a heavily blurred thumbnail before someone subscribes.",
    icon: ImageIcon,
  },
];

export function LockedPreviewPicker({
  value,
  onChange,
}: {
  value: LockedPreviewMode;
  onChange: (value: LockedPreviewMode) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">Locked preview</legend>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Choose what people see before they subscribe. Hidden is the private default.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.value;
          const Icon = option.icon;

          return (
            <label
              key={option.value}
              className={cn(
                "relative flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors hover:bg-accent/60",
                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                selected
                  ? "border-foreground bg-accent/60"
                  : "border-border/70 bg-background/50",
              )}
            >
              <input
                type="radio"
                name="locked-preview-mode"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  selected
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {option.label}
                  {option.value === "hidden" && (
                    <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                      Default
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {option.helper}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
