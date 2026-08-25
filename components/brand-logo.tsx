import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  priority = false,
  alt = "Udala",
}: {
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <Image
      src="/udala-logo.png"
      alt={alt}
      width={1280}
      height={1280}
      priority={priority}
      className={cn("rounded-lg object-contain", className)}
    />
  );
}
