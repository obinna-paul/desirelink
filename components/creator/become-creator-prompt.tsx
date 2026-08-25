import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BecomeCreatorPrompt() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
        <Sparkles className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">Become a creator</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Turn on Creator on your profile to unlock subscription tiers, paid posts, and the
          creator dashboard — subscribers, revenue, and analytics all in one place.
        </p>
      </div>
      <Button asChild>
        <Link href="/profile/edit">Turn on Creator</Link>
      </Button>
    </div>
  );
}
