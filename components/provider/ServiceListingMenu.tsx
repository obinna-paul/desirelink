"use client";

import { useState } from "react";
import { Clock } from "lucide-react";

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

function ServiceListingCard({ listing }: { listing: ServiceListingView }) {
  const [bookClicked, setBookClicked] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4">
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
      <Button type="button" variant="outline" onClick={() => setBookClicked(true)} disabled={bookClicked}>
        {bookClicked ? "Booking coming soon" : "Book"}
      </Button>
    </div>
  );
}

export function ServiceListingMenu({ listings }: { listings: ServiceListingView[] }) {
  if (listings.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <ServiceListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
