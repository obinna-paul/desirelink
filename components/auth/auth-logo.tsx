import Image from "next/image";
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

  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-11 w-fit items-center gap-3", className)}
      aria-label="Udala home"
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
          compact ? "h-11 w-11" : "h-12 w-12"
        )}
        aria-hidden="true"
      >
        <Image
          src={logoSrc}
          alt=""
          width={500}
          height={500}
          priority
          unoptimized
          className="h-[88px] w-[88px] max-w-none -translate-y-2 object-contain"
        />
      </span>
      <span
        className={cn(
          "font-heading font-semibold tracking-tight",
          compact ? "text-xl" : "text-2xl",
          variant === "dark" ? "text-white" : "text-[#211720]"
        )}
      >
        Udala
      </span>
    </Link>
  );
}
