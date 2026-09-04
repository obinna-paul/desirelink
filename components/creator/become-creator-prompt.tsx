import Link from "next/link";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BecomeCreatorPrompt() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
        <Coins className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">Set up earning tools</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Add tiers, publish services, and review your earning dashboard when you are ready
          to monetize your activity on Udala.
        </p>
      </div>
      <Button asChild className="w-full md:w-auto">
        <Link href="/creator-dashboard">Open Creator Studio</Link>
      </Button>
    </div>
  );
}
