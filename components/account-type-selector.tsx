"use client";

import type { AccountType } from "@prisma/client";

import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";

export function AccountTypeSelector({
  value,
  onChange,
  name = "accountType",
  className,
}: {
  value: AccountType;
  onChange: (value: AccountType) => void;
  name?: string;
  className?: string;
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
              selected
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
            <span className="text-xs text-muted-foreground">{option.description}</span>
          </label>
        );
      })}
    </div>
  );
}
