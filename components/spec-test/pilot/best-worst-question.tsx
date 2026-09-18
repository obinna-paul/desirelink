"use client";

import { Check } from "lucide-react";

import type { BestWorstItemV3 } from "@/lib/spec-test/items/spec-v3";
import { renderTerms } from "@/lib/spec-test/gender/render";
import type { RenderForm } from "@/lib/spec-test/gender/terms";
import { cn } from "@/lib/utils";

export type BestWorstSelection = {
  bestOptionId: string | null;
  worstOptionId: string | null;
};

type BestWorstQuestionProps = {
  item: BestWorstItemV3;
  value: BestWorstSelection;
  onChange: (value: BestWorstSelection) => void;
  optionOrder?: number[];
  disabled?: boolean;
  form?: RenderForm;
};

/** Accessible pilot control for comparative blocks. Both judgments remain visible at once,
 * and every action is a native button with a 44px target. Selecting an option on the other
 * pole moves it instead of allowing an invalid "most and least" state. */
export function BestWorstQuestion({
  item,
  value,
  onChange,
  optionOrder = [0, 1, 2, 3],
  disabled = false,
  form = "neutral",
}: BestWorstQuestionProps) {
  function select(optionId: string, pole: "best" | "worst") {
    if (pole === "best") {
      onChange({
        bestOptionId: value.bestOptionId === optionId ? null : optionId,
        worstOptionId: value.worstOptionId === optionId ? null : value.worstOptionId,
      });
      return;
    }
    onChange({
      bestOptionId: value.bestOptionId === optionId ? null : value.bestOptionId,
      worstOptionId: value.worstOptionId === optionId ? null : optionId,
    });
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-5" disabled={disabled}>
      <legend className="font-heading text-xl font-bold sm:text-2xl">{renderTerms(item.prompt, form)}</legend>
      <p className="text-sm leading-6 text-muted-foreground">
        First choose your biggest yes. Then choose the one that does the least for you.
      </p>

      <div className="flex flex-col gap-3">
        {optionOrder.map((canonicalIndex) => {
          const option = item.options[canonicalIndex];
          if (!option) return null;
          const isBest = value.bestOptionId === option.id;
          const isWorst = value.worstOptionId === option.id;

          return (
            <div
              key={option.id}
              className={cn(
                "rounded-2xl border bg-card p-3 transition-colors",
                (isBest || isWorst) && "border-primary/70 bg-accent-tint/50",
              )}
            >
              <p className="px-1 pb-3 text-sm font-medium leading-6">{renderTerms(option.label, form)}</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Rate: ${renderTerms(option.label, form)}`}>
                <button
                  type="button"
                  aria-pressed={isBest}
                  aria-label={`Most: ${renderTerms(option.label, form)}`}
                  data-testid={`v3-most-${option.id}`}
                  onClick={() => select(option.id, "best")}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold",
                    "transition-[background-color,border-color,color,transform] active:scale-[0.98]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isBest
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/60",
                  )}
                >
                  {isBest && <Check className="h-4 w-4" aria-hidden="true" />}
                  My type
                </button>
                <button
                  type="button"
                  aria-pressed={isWorst}
                  aria-label={`Least: ${renderTerms(option.label, form)}`}
                  data-testid={`v3-least-${option.id}`}
                  onClick={() => select(option.id, "worst")}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold",
                    "transition-[background-color,border-color,color,transform] active:scale-[0.98]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isWorst
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:border-foreground/60",
                  )}
                >
                  {isWorst && <Check className="h-4 w-4" aria-hidden="true" />}
                  Not really
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
