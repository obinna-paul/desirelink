import Link from "next/link";
import { Radio } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { LiveStreamProviderSummary } from "@/lib/live-streams";

/** Shown when a stream is genuinely live but the visitor isn't logged in - watching (and
 * getting a LiveKit token) requires an account, same boundary /profile/[username] draws
 * between "viewable" and "requires login to act." */
export function LiveLockedNotice({
  streamId,
  title,
  provider,
}: {
  streamId: string;
  title: string;
  provider: LiveStreamProviderSummary;
}) {
  const initials = provider.displayName.slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-10 text-center">
      <Avatar className="h-16 w-16 border border-border">
        <AvatarImage src={provider.avatarUrl} alt={provider.displayName} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div>
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          Live now
        </p>
        <h1 className="mt-2 font-heading text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {provider.displayName} (@{provider.username}) is live right now.
        </p>
      </div>

      <Button asChild className="w-full">
        <Link href={`/login?callbackUrl=${encodeURIComponent(`/live/${streamId}`)}`}>Log in to watch</Link>
      </Button>
    </div>
  );
}
