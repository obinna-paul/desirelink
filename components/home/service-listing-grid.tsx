"use client";

import Image from "next/image";
import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2, Clock, MapPin, MessageCircle } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/ui/share-button";
import { BookingRequestDialog } from "@/components/services/booking-request-dialog";
import { formatCents } from "@/lib/creator";
import type { HomeServiceListingView } from "@/lib/service-listings";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr${hours === 1 ? "" : "s"}` : `${hours}h ${remainder}m`;
}

function ServiceListingCard({
  listing,
  viewerProfileId,
}: {
  listing: HomeServiceListingView;
  viewerProfileId: string | null;
}) {
  const provider = listing.provider;
  const isVerified =
    provider.isVerified || provider.isVerifiedCreator || provider.isVerifiedServiceProvider || provider.isTrustedMember;
  const isOwnListing = viewerProfileId === provider.id;

  return (
    <article className="group flex min-h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card transition-[border-color,box-shadow,transform] hover:border-foreground/20 hover:shadow-lift md:hover:-translate-y-0.5">
      <Link href={`/services/${listing.id}`} className="relative aspect-[16/10] w-full overflow-hidden bg-avatar-placeholder">
        {listing.coverImageUrl ? (
          <Image src={listing.coverImageUrl} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BriefcaseBusiness className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Link href={`/profile/${provider.username}`} aria-label={`View ${provider.displayName}`}>
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={provider.avatarUrl} alt="" />
              <AvatarFallback>{initials(provider.displayName)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/profile/${provider.username}`}
              className="flex min-h-6 items-center gap-1.5 text-sm font-semibold hover:text-primary"
            >
              <span className="truncate">{provider.displayName}</span>
              {isVerified && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-label="Verified creator" />
              )}
            </Link>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {[provider.city, provider.country].filter(Boolean).join(", ") || "Location hidden"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase text-primary">{listing.category}</p>
          <h2 className="text-base font-semibold leading-snug">
            <Link href={`/services/${listing.id}`} className="hover:underline">
              {listing.title}
            </Link>
          </h2>
          {listing.description && (
            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{listing.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {formatDuration(listing.durationMinutes)}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{formatCents(listing.priceCents)}</span>
            <ShareButton
              href={`/services/${listing.id}`}
              title={listing.title}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            />
          </div>
        </div>

        {!isOwnListing && viewerProfileId && (
          <div className="flex flex-col gap-2">
            <BookingRequestDialog listingId={listing.id} title={listing.title} priceCents={listing.priceCents} />
            <Button asChild variant="outline" className="w-full gap-1.5">
              <Link href={`/messages?with=${provider.username}`}>
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Contact provider
              </Link>
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

export function ServiceListingGrid({
  listings,
  emptyMessage,
  viewerProfileId = null,
}: {
  listings: HomeServiceListingView[];
  emptyMessage: string;
  viewerProfileId?: string | null;
}) {
  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground md:rounded-xl md:p-10">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
      {listings.map((listing) => (
        <ServiceListingCard key={listing.id} listing={listing} viewerProfileId={viewerProfileId} />
      ))}
    </div>
  );
}
