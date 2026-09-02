import Link from "next/link";
import { Compass, Radio, BriefcaseBusiness } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCents } from "@/lib/creator";
import type { LiveRingEntry } from "@/lib/live-streams";
import type { HomeServiceListingView } from "@/lib/service-listings";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "U";
}

export function ExplorerDiscoveryPanel({
  onlineCreators,
  services,
}: {
  onlineCreators: LiveRingEntry[];
  services: HomeServiceListingView[];
}) {
  const hasAnything = onlineCreators.length > 0 || services.length > 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm md:shadow-card">
      <div className="flex items-center gap-2">
        <Compass className="h-4 w-4 text-neon-pink" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">Discover</p>
      </div>

      {!hasAnything && (
        <p className="text-sm text-muted-foreground">
          Nothing new right now. Check back soon for creators and services near you.
        </p>
      )}

      {onlineCreators.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Radio className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              Online now
            </div>
            <Link href="/discover" className="text-xs font-semibold text-neon-pink hover:underline">
              See all
            </Link>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {onlineCreators.map((creator) => (
              <li key={creator.id}>
                <Link
                  href={`/profile/${creator.username}`}
                  className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/45 px-3 py-2 transition-colors hover:border-neon-pink/40 hover:bg-accent/60"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={creator.avatarUrl} alt="" />
                    <AvatarFallback>{initials(creator.displayName)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {creator.displayName}
                  </span>
                  <span
                    className={
                      creator.isLive
                        ? "shrink-0 rounded-full bg-neon-pink/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neon-pink"
                        : "h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                    }
                    aria-hidden={!creator.isLive}
                  >
                    {creator.isLive ? "Live" : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {services.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BriefcaseBusiness className="h-3.5 w-3.5 text-neon-pink" aria-hidden="true" />
              Services near you
            </div>
            <Link href="/services" className="text-xs font-semibold text-neon-pink hover:underline">
              See all
            </Link>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {services.map((listing) => (
              <li key={listing.id}>
                <Link
                  href="/services"
                  className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/45 px-3 py-2 transition-colors hover:border-neon-pink/40 hover:bg-accent/60"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={listing.provider.avatarUrl} alt="" />
                    <AvatarFallback>{initials(listing.provider.displayName)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{listing.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {listing.provider.displayName}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    {formatCents(listing.priceCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
