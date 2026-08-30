import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * A single consolidated upsell shown in place of a run of provider posts the
 * viewer has hit their daily free-view limit on — instead of rendering one
 * identical locked card per post (which turns the feed into a wall of
 * paywalls). `count` is how many locked posts this card stands in for.
 */
export function FeedPremiumGate({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-6 text-center shadow-card md:rounded-xl md:p-8">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-tint">
        <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
      </span>
      <p className="font-heading text-base italic font-medium">You&apos;ve reached today&apos;s free provider posts</p>
      <p className="max-w-sm text-xs leading-5 text-muted-foreground">
        {count > 1
          ? `${count} more provider posts are waiting. Upgrade to Premium for unlimited access to provider content.`
          : "Upgrade to Premium for unlimited access to provider content."}
      </p>
      <Button asChild size="sm" className="mt-1">
        <Link href="/settings/billing">Upgrade to Premium</Link>
      </Button>
    </div>
  );
}
