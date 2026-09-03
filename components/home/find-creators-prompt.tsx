import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Shared copy/CTA for the Premium tab's two "go find someone to subscribe to" moments:
 * "empty" when the viewer has zero active subscriptions at all, "end-of-list" appended
 * after their subscribed creators' premium posts (however many or few there are).
 */
export function FindCreatorsPrompt({ variant }: { variant: "empty" | "end-of-list" }) {
  if (variant === "empty") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/60 p-8 text-center md:rounded-xl md:p-10">
        <p className="text-sm text-foreground">
          Looks like you haven&rsquo;t subscribed to any creator yet! But don&rsquo;t worry, we&rsquo;ve got you.
        </p>
        <p className="text-sm text-muted-foreground">If you want to see premium content, find a creator here:</p>
        <Button asChild className="mt-2">
          <Link href="/creators">Find creators</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
      <p className="text-sm text-muted-foreground">You&rsquo;re all caught up on premium content from your creators.</p>
      <Button asChild variant="outline" size="sm" className="mt-1">
        <Link href="/creators">Find more creators</Link>
      </Button>
    </div>
  );
}
