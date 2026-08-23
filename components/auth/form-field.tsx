import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";

export function FormField({
  label,
  type = "text",
  error,
  registration,
  autoComplete,
}: {
  label: string;
  type?: string;
  error?: string;
  registration: UseFormRegisterReturn;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={registration.name} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={registration.name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        {...registration}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
