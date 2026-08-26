import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

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
  const logoSrc = variant === "dark" ? "/udala-logo.png" : "/udala-logo-light.png";

  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-11 w-fit items-center", className)}
      aria-label="Udala home"
    >
      <span
        className={cn(
          "relative block shrink-0 overflow-visible",
          compact ? "h-11 w-28" : "h-14 w-32"
        )}
        aria-hidden="true"
      >
        <Image
          src={logoSrc}
          alt=""
          fill
          priority
          sizes={compact ? "112px" : "128px"}
          className="scale-[1.75] object-contain"
        />
      </span>
      <span className="sr-only">Udala</span>
    </Link>
  );
}
