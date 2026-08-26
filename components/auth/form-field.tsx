"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={registration.name}
        className={cn("text-sm font-medium", isAuth && "text-white/82", isLightAuth && "text-[#211720]")}
      >
        {label}
      </label>
      <div className="relative">
        <Input
          id={registration.name}
          type={isPassword && showPassword ? "text" : type}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          className={cn(
            isPassword && "pr-12",
            isAuth &&
              "h-12 rounded-lg border-white/12 bg-white/[0.055] text-white shadow-none placeholder:text-white/35 focus-visible:ring-[#f8b7c8]",
            isLightAuth &&
              "h-12 rounded-lg border-[#d8c8d2] bg-white text-[#211720] shadow-none placeholder:text-[#9b8e97] focus-visible:ring-[#9b2f66]"
          )}
          {...registration}
        />
        {isPassword && (
          <button
            type="button"
            aria-label={showPassword ? "Hide password value" : "Show password value"}
            aria-pressed={showPassword}
            aria-controls={registration.name}
            onClick={() => setShowPassword((current) => !current)}
            className={cn(
              "absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isAuth
                ? "text-white/58 hover:bg-white/10 hover:text-white"
                : "text-[#7c6b76] hover:bg-[#f6eef3] hover:text-[#211720]"
            )}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p className={cn("text-xs text-destructive", isAuth && "text-red-300", isLightAuth && "text-[#b42318]")}>
          {error}
        </p>
      )}
    </div>
  );
}
