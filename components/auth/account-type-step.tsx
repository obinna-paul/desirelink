"use client";

import type { ProfileType } from "@prisma/client";

import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import { cn } from "@/lib/utils";

/** Signup's account-type step: a simple Explorer/Provider choice. */
export function AccountTypeStep({
  value,
  onChange,
}: {
  value: ProfileType;
  onChange: (value: ProfileType) => void;
}) {
  return (
    <div role="radiogroup" aria-label="How will you use udala?" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ACCOUNT_TYPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex min-h-[44px] flex-col gap-1 rounded-xl border p-4 text-left transition-colors",
            value === option.value
              ? "border-[#9b2f66] bg-[#fff4f8] text-[#211720] shadow-sm"
              : "border-[#d8c8d2] bg-white text-[#211720] hover:border-[#b893a6]"
          )}
        >
          <span className="text-sm font-semibold">{option.label}</span>
          <span className="text-xs text-[#756771]">{option.description}</span>
        </button>
      ))}
    </div>
  );
}
