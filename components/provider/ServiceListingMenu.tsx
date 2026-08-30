import Image from "next/image";
import Link from "next/link";
import { BriefcaseBusiness, Clock, MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/creator";
import type { ServiceListingView } from "@/lib/service-listings";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr${hours === 1 ? "" : "s"}` : `${hours}h ${remainder}m`;
}

export function ServiceListingSummaryCard({
  listing,
  providerUsername,
  isOwner,
}: {
  listing: ServiceListingView;
  providerUsername: string;
  isOwner: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="relative aspect-video w-full bg-secondary">
        {listing.coverImageUrl ? (
          <Image src={listing.coverImageUrl} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BriefcaseBusiness className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 px-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold">{listing.title}</p>
          <Badge variant="outline">{listing.category}</Badge>
        </div>
        {listing.description && <p className="text-sm text-muted-foreground">{listing.description}</p>}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDuration(listing.durationMinutes)}
          </span>
          <span className="font-semibold text-primary">{formatCents(listing.priceCents)}</span>
        </div>
        {!isOwner && (
          <Button asChild variant="outline" className="gap-1.5">
            <Link href={`/messages?with=${providerUsername}`}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Contact provider
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function ServiceListingMenu({
  listings,
  providerUsername,
  isOwner,
}: {
  listings: ServiceListingView[];
  providerUsername: string;
  isOwner: boolean;
}) {
  if (listings.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <ServiceListingSummaryCard key={listing.id} listing={listing} providerUsername={providerUsername} isOwner={isOwner} />
      ))}
    </div>
  );
}
