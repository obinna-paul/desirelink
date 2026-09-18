"use client";

import { Check } from "lucide-react";

import type { UncertaintyItemV3 } from "@/lib/spec-test/items/spec-v3-pilot";
import { cn } from "@/lib/utils";

type SingleChoiceQuestionProps = {
  item: UncertaintyItemV3;
  value: string | null;
  onChange: (optionId: string) => void;
  optionOrder?: number[];
  disabled?: boolean;
};

export function SingleChoiceQuestion({
  item,
  value,
  onChange,
  optionOrder = [0, 1, 2, 3],
  disabled = false,
}: SingleChoiceQuestionProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-5" disabled={disabled}>
      <legend className="font-heading text-xl font-bold sm:text-2xl">{item.prompt}</legend>
      <p className="text-sm leading-6 text-muted-foreground">Choose the response closest to your first instinct.</p>
      <div className="flex flex-col gap-3">
        {optionOrder.map((canonicalIndex) => {
          const option = item.options[canonicalIndex];
          if (!option) return null;
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border bg-card px-4 py-3.5",
                "text-left text-sm font-medium transition-[background-color,border-color,transform] active:scale-[0.99]",
                selected ? "border-primary bg-accent-tint" : "border-border hover:border-primary/60",
              )}
            >
              <input
                type="radio"
                name={item.id}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                )}
                aria-hidden="true"
              >
                {selected && <Check className="h-4 w-4" />}
              </span>
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
