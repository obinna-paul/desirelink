import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  type = "text",
  error,
  registration,
  autoComplete,
  variant = "default",
}: {
  label: string;
  type?: string;
  error?: string;
  registration: UseFormRegisterReturn;
  autoComplete?: string;
  variant?: "default" | "auth" | "lightAuth";
}) {
  const isAuth = variant === "auth";
  const isLightAuth = variant === "lightAuth";

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={registration.name}
        className={cn("text-sm font-medium", isAuth && "text-white/82", isLightAuth && "text-[#211720]")}
      >
        {label}
      </label>
      <Input
        id={registration.name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className={cn(
          isAuth &&
            "h-12 rounded-lg border-white/12 bg-white/[0.055] text-white shadow-none placeholder:text-white/35 focus-visible:ring-[#f8b7c8]",
          isLightAuth &&
            "h-12 rounded-lg border-[#d8c8d2] bg-white text-[#211720] shadow-none placeholder:text-[#9b8e97] focus-visible:ring-[#9b2f66]"
        )}
        {...registration}
      />
      {error && (
        <p className={cn("text-xs text-destructive", isAuth && "text-red-300", isLightAuth && "text-[#b42318]")}>
          {error}
        </p>
      )}
    </div>
  );
}
