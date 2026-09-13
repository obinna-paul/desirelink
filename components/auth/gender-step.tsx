"use client";

import { GENDER_OPTIONS } from "@/lib/profile-options";
import { cn } from "@/lib/utils";

/** Onboarding's gender step - a compact single-column list (unlike AccountTypeStep's
 * 3-card grid) since there are 8 options here, not 3, and none need a description. */
export function GenderStep({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="What's your gender?" className="flex flex-col gap-2">
      {GENDER_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "flex min-h-[44px] items-center rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
            value === option
              ? "border-[#9b2f66] bg-[#fff4f8] text-[#211720] shadow-sm"
              : "border-[#d8c8d2] bg-white text-[#211720] hover:border-[#b893a6]"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
