import { Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PremiumBadge({ className }: { className?: string }) {
  return (
    <Badge variant="neon" className={cn("gap-1 border-primary/30 bg-primary text-primary-foreground", className)}>
      <Crown className="h-3 w-3" aria-hidden="true" />
      premium
    </Badge>
  );
}
