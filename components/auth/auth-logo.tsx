import Link from "next/link";

import { cn } from "@/lib/utils";
import logoDark from "@/public/udala-logo.png";
import logoLight from "@/public/udala-logo-light.png";

export function AuthLogo({
  href = "/landing",
  variant = "light",
  compact = false,
  className,
}: {
  href?: string;
  variant?: "light" | "dark";
  compact?: boolean;
  className?: string;
}) {
  const logoSrc = variant === "dark" ? logoDark : logoLight;
  const logoUrl = typeof logoSrc === "string" ? logoSrc : logoSrc.src;

  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-11 w-fit items-center gap-3", className)}
      aria-label="Udala home"
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
          variant === "dark" ? "bg-white/8" : "bg-[#f8edf3]",
          compact ? "h-11 w-11" : "h-12 w-12"
        )}
        aria-hidden="true"
      >
        <span
          className="absolute inset-0 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${logoUrl})` }}
        />
        <span className="font-brand text-lg font-semibold text-[#8f2ff0]">U</span>
      </span>
      <span
        className={cn(
          "font-brand font-semibold tracking-tight",
          compact ? "text-xl" : "text-2xl",
          variant === "dark" ? "text-white" : "text-[#211720]"
        )}
      >
        Udala
      </span>
    </Link>
  );
}
