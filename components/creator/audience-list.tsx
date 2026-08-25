import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { getSubscribers } from "@/lib/creator";

type Subscribers = Awaited<ReturnType<typeof getSubscribers>>;

const STATUS_VARIANT = {
  active: "neon",
  cancelled: "outline",
  expired: "secondary",
} as const;

export function AudienceList({ subscribers }: { subscribers: Subscribers }) {
  if (subscribers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        No Fans yet. Once people subscribe to one of your tiers, they&apos;ll show up here.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {subscribers.map((sub) => {
        const initials = sub.subscriber.displayName.slice(0, 2).toUpperCase();
        return (
          <li key={sub.id}>
            <Link
              href={`/profile/${sub.subscriber.username}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 transition-colors hover:border-neon-pink/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src={sub.subscriber.avatarUrl} alt={sub.subscriber.displayName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{sub.subscriber.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{sub.subscriber.username} &middot; {sub.tier.name}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={STATUS_VARIANT[sub.status]}>{sub.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  Since {sub.startsAt.toLocaleDateString()}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
