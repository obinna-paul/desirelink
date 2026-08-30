"use client";

import { useState } from "react";
import type { ProfileType } from "@prisma/client";

import { AccountTypeSelector } from "@/components/account-type-selector";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import { cn } from "@/lib/utils";

const PROVIDER_OPTIONS = ACCOUNT_TYPE_OPTIONS.filter((option) => option.value !== "EXPLORER");
const EXPLORER_DESCRIPTION = ACCOUNT_TYPE_OPTIONS.find((option) => option.value === "EXPLORER")!.description;

type Mode = "explorer" | "provider";

/**
 * Signup's account-type step: a simple Explorer/Provider choice up front,
 * with the specific provider flavor (Creator/Pair/Service Provider) asked as
 * an immediate follow-up only when "Provider" is picked. `value` is always a
 * real ProfileType — "provider" mode is a client-only grouping, not stored.
 */
export function AccountTypeStep({
  value,
  onChange,
}: {
  value: ProfileType;
  onChange: (value: ProfileType) => void;
}) {
  const [mode, setMode] = useState<Mode>(value === "EXPLORER" ? "explorer" : "provider");

  function selectMode(next: Mode) {
    setMode(next);
    if (next === "explorer") {
      onChange("EXPLORER");
    } else if (value === "EXPLORER") {
      onChange(PROVIDER_OPTIONS[0].value);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="How will you use udala?" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "explorer"}
          onClick={() => selectMode("explorer")}
          className={cn(
            "flex min-h-[44px] flex-col gap-1 rounded-xl border p-4 text-left transition-colors",
            mode === "explorer"
              ? "border-[#9b2f66] bg-[#fff4f8] text-[#211720] shadow-sm"
              : "border-[#d8c8d2] bg-white text-[#211720] hover:border-[#b893a6]"
          )}
        >
          <span className="text-sm font-semibold">Explorer</span>
          <span className="text-xs text-[#756771]">{EXPLORER_DESCRIPTION}</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "provider"}
          onClick={() => selectMode("provider")}
          className={cn(
            "flex min-h-[44px] flex-col gap-1 rounded-xl border p-4 text-left transition-colors",
            mode === "provider"
              ? "border-[#9b2f66] bg-[#fff4f8] text-[#211720] shadow-sm"
              : "border-[#d8c8d2] bg-white text-[#211720] hover:border-[#b893a6]"
          )}
        >
          <span className="text-sm font-semibold">Provider</span>
          <span className="text-xs text-[#756771]">Create content, host events, or offer services.</span>
        </button>
      </div>

      {mode === "provider" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[#756771]">What kind of provider are you?</p>
          <AccountTypeSelector
            value={value === "EXPLORER" ? PROVIDER_OPTIONS[0].value : value}
            onChange={onChange}
            options={PROVIDER_OPTIONS}
            variant="lightAuth"
          />
        </div>
      )}
    </div>
  );
}
