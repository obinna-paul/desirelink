import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Users } from "lucide-react";

import { formatCents } from "@/lib/creator";
import type { SubscribableCreator } from "@/lib/creators-directory";

export function CreatorCard({ creator }: { creator: SubscribableCreator }) {
  const initials = creator.displayName.slice(0, 2).toUpperCase();
  const isVerified = creator.isVerified || creator.isVerifiedCreator;

  return (
    <Link
      href={`/profile/${creator.username}`}
      className="group min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card transition-[border-color,box-shadow,transform] hover:border-foreground/20 hover:shadow-lift md:hover:-translate-y-0.5"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {creator.avatarUrl ? (
          <Image
            src={creator.avatarUrl}
            alt={creator.displayName}
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 1279px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl font-semibold text-muted-foreground md:text-4xl">
            {initials}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 p-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{creator.displayName}</p>
          {isVerified && <BadgeCheck className="h-4 w-4 shrink-0 fill-primary text-primary-foreground" aria-label="Verified" />}
        </div>
        <p className="truncate text-xs text-muted-foreground">@{creator.username}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">From {formatCents(creator.minTierPriceCents)}/mo</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" aria-hidden="true" />
            {creator.subscriberCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
