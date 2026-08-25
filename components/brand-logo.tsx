"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  priority = false,
  alt = "udala",
}: {
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const src = mounted && resolvedTheme === "dark" ? "/udala-logo.png" : "/udala-logo-light.png";

  return (
    <Image
      src={src}
      alt={alt}
      width={1280}
      height={1280}
      priority={priority}
      className={cn("rounded-lg object-contain", className)}
    />
  );
}
