"use client";

import Image from "next/image";
import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2, Clock, MapPin, MessageCircle } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <article className="flex min-h-full flex-col gap-3 rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-primary/30 md:rounded-xl">
      <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-avatar-placeholder md:rounded-t-xl">
        {listing.coverImageUrl ? (
          <Image src={listing.coverImageUrl} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BriefcaseBusiness className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex items-start gap-3">
          <Link href={`/profile/${provider.username}`} aria-label={`View ${provider.displayName}`}>
            <Avatar className="h-12 w-12">
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
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-label="Verified provider" />
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
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base italic font-semibold leading-snug">{listing.title}</h2>
            <Badge variant="tint" className="label-caps shrink-0">
              {listing.category}
            </Badge>
          </div>
          {listing.description && (
            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{listing.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {formatDuration(listing.durationMinutes)}
          </span>
          <span className="font-heading text-sm font-semibold text-foreground">{formatCents(listing.priceCents)}</span>
        </div>

        {!isOwnListing && viewerProfileId && (
          <Button asChild className="w-full gap-1.5">
            <Link href={`/messages?with=${provider.username}`}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Contact provider
            </Link>
          </Button>
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 2xl:grid-cols-3">
      {listings.map((listing) => (
        <ServiceListingCard key={listing.id} listing={listing} viewerProfileId={viewerProfileId} />
      ))}
    </div>
  );
}
