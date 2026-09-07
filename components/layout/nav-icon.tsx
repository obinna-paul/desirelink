import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const motionClassByHref: Record<string, string> = {
  "/": "nav-icon-home",
  "/discover": "nav-icon-discover",
  "/create": "nav-icon-create",
  "/messages": "nav-icon-messages",
  "/profile": "nav-icon-profile",
};

export function NavIcon({
  icon: Icon,
  href,
  active,
  animate,
  className,
}: {
  icon: LucideIcon;
  href: string;
  active: boolean;
  animate: boolean;
  className?: string;
}) {
  return (
    <Icon
      className={cn(
        "nav-icon-glyph",
        animate && (motionClassByHref[href] ?? "nav-icon-settle"),
        active ? "text-primary" : "text-muted-foreground",
        active && href === "/" && "fill-primary/10",
        active && href === "/messages" && "fill-primary/10",
        className,
      )}
      aria-hidden="true"
      strokeWidth={active ? 2.25 : 2}
    />
  );
}
