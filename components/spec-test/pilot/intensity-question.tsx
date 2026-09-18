"use client";

import type { IntensityItemV3 } from "@/lib/spec-test/items/spec-v3-pilot";
import { cn } from "@/lib/utils";

type IntensityQuestionProps = {
  item: IntensityItemV3;
  value: number | null;
  onChange: (rating: 1 | 2 | 3 | 4 | 5 | 6 | 7) => void;
  disabled?: boolean;
};

const RATINGS = [1, 2, 3, 4, 5, 6, 7] as const;

export function IntensityQuestion({ item, value, onChange, disabled = false }: IntensityQuestionProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-5" disabled={disabled}>
      <legend className="font-heading text-xl font-bold sm:text-2xl">{item.prompt}</legend>
      <p className="text-sm leading-6 text-muted-foreground">
        Choose the point that best reflects attraction—not whether the quality is generally good.
      </p>
      <div className="grid grid-cols-7 gap-2" aria-label="Attraction intensity from 1 to 7">
        {RATINGS.map((rating) => (
          <label key={rating} className="relative cursor-pointer">
            <input
              type="radio"
              name={item.id}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex min-h-11 items-center justify-center rounded-xl border bg-background text-sm font-semibold",
                "transition-[background-color,border-color,color,transform] active:scale-[0.98]",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                value === rating
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/60",
              )}
            >
              {rating}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-between gap-4 text-xs font-medium text-muted-foreground">
        <span>{item.lowLabel}</span>
        <span className="text-right">{item.highLabel}</span>
      </div>
    </fieldset>
  );
}
