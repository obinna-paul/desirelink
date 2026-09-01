import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { BriefcaseBusiness, CheckCircle2, Clock, MapPin, MessageCircle } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/ui/share-button";
import { BookingRequestDialog } from "@/components/services/booking-request-dialog";
import { formatCents } from "@/lib/creator";
import { getServiceListingById } from "@/lib/service-listings";
import { absoluteUrl, SITE_NAME } from "@/lib/site-config";

export const dynamic = "force-dynamic";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr${hours === 1 ? "" : "s"}` : `${hours}h ${remainder}m`;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const listing = await getServiceListingById(params.id);
  if (!listing) return { title: "Service not found" };

  const title = listing.title;
  const description = listing.description
    ? listing.description.slice(0, 160)
    : `${listing.title} by ${listing.provider.displayName} on ${SITE_NAME}.`;
  const url = absoluteUrl(`/services/${listing.id}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      images: listing.coverImageUrl ? [{ url: listing.coverImageUrl }] : undefined,
    },
    twitter: {
      card: listing.coverImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: listing.coverImageUrl ? [listing.coverImageUrl] : undefined,
    },
  };
}

export default async function ServiceListingDetailPage({ params }: { params: { id: string } }) {
  const listing = await getServiceListingById(params.id);
  if (!listing) notFound();

  const session = await getServerSession(authOptions);
  const viewerProfile = session?.user?.id
    ? await prisma.profile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null;

  const provider = listing.provider;
  const isVerified =
    provider.isVerified || provider.isVerifiedCreator || provider.isVerifiedServiceProvider || provider.isTrustedMember;
  const isOwnListing = viewerProfile?.id === provider.id;
  const initials = provider.displayName.slice(0, 2).toUpperCase();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: listing.title,
    description: listing.description || undefined,
    category: listing.category,
    image: listing.coverImageUrl || undefined,
    url: absoluteUrl(`/services/${listing.id}`),
    provider: {
      "@type": "Person",
      name: provider.displayName,
      url: absoluteUrl(`/profile/${provider.username}`),
    },
    offers: {
      "@type": "Offer",
      price: (listing.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      url: absoluteUrl(`/services/${listing.id}`),
    },
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 md:gap-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:rounded-xl md:shadow-none">
        <div className="relative flex h-52 w-full items-center justify-center overflow-hidden bg-avatar-placeholder md:h-64">
          {listing.coverImageUrl ? (
            <Image
              src={listing.coverImageUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 42rem, 100vw"
              className="object-cover"
            />
          ) : (
            <BriefcaseBusiness className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase text-primary">{listing.category}</p>
            <h1 className="font-heading text-2xl font-semibold leading-tight text-foreground">
              {listing.title}
            </h1>
          </div>

          <div className="flex items-center justify-between gap-3 border-y border-border/60 py-3 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatDuration(listing.durationMinutes)}
            </span>
            <span className="font-semibold text-foreground">{formatCents(listing.priceCents)}</span>
          </div>

          {listing.description && (
            <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {listing.description}
            </p>
          )}

          <Link
            href={`/profile/${provider.username}`}
            className="flex w-full items-center gap-2 rounded-2xl border border-border/60 bg-background px-3 py-2.5 transition-colors hover:border-neon-pink/60 md:w-fit md:rounded-lg md:py-2"
          >
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={provider.avatarUrl} alt="" />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                Offered by
                {isVerified && <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-label="Verified provider" />}
              </p>
              <p className="truncate text-sm font-medium">{provider.displayName}</p>
            </div>
          </Link>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {[provider.city, provider.country].filter(Boolean).join(", ") || "Location hidden"}
          </p>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4 [&>*]:w-full md:[&>*]:w-auto">
            {!isOwnListing && viewerProfile && (
              <>
                <BookingRequestDialog listingId={listing.id} title={listing.title} priceCents={listing.priceCents} />
                <Button asChild variant="outline" className="gap-1.5">
                  <Link href={`/messages?with=${provider.username}`}>
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> Contact provider
                  </Link>
                </Button>
              </>
            )}
            {!isOwnListing && !viewerProfile && (
              <Button asChild className="gap-1.5">
                <Link href={`/login?callbackUrl=${encodeURIComponent(`/services/${listing.id}`)}`}>
                  Log in to book
                </Link>
              </Button>
            )}
            <ShareButton href={`/services/${listing.id}`} title={listing.title} label="Share" variant="outline" />
          </div>
        </div>
      </div>
    </div>
  );
}
