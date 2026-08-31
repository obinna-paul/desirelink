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
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
        No Fans yet. Once people subscribe, they&apos;ll show up here.
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
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-3.5 py-3 shadow-sm transition-colors hover:border-neon-pink/60 md:rounded-lg md:px-4 md:shadow-none"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-11 w-11 border border-border md:h-10 md:w-10">
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
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
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
