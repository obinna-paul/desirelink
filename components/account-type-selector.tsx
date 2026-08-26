"use client";

import type { ProfileType } from "@prisma/client";

import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";

export function AccountTypeSelector({
  value,
  onChange,
  name = "profileType",
  className,
  variant = "default",
}: {
  value: ProfileType;
  onChange: (value: ProfileType) => void;
  name?: string;
  className?: string;
  variant?: "default" | "auth";
}) {
  return (
    <div role="radiogroup" aria-label="Account type" className={cn("grid grid-cols-1 gap-3", className)}>
      {ACCOUNT_TYPE_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex min-h-[44px] cursor-pointer flex-col gap-1 rounded-xl border p-4 text-left transition-colors",
              variant === "auth"
                ? selected
                  ? "border-[#f8b7c8]/70 bg-[#f8b7c8]/12 text-white"
                  : "border-white/10 bg-white/[0.04] text-white hover:border-white/24"
                : selected
                  ? "border-primary bg-secondary"
                  : "border-border/60 bg-card hover:border-primary/50"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="text-sm font-semibold">{option.label}</span>
            <span className={variant === "auth" ? "text-xs text-white/56" : "text-xs text-muted-foreground"}>
              {option.description}
            </span>
          </label>
        );
      })}
    </div>
  );
}
