import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/udala-logo.png"
      alt="Udala"
      width={1280}
      height={1280}
      priority={priority}
      className={cn("rounded-lg object-contain", className)}
    />
  );
}
