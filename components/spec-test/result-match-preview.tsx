import Image from "next/image";
import { BadgeCheck, MapPin } from "lucide-react";

import type { ResultMatchPreview } from "@/lib/spec-test/result-matches";

export function ResultMatchPreviewCard({ profile }: { profile: ResultMatchPreview }) {
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const verified = profile.isVerified || profile.isVerifiedCreator;
  const preciseLocation = [profile.city, profile.country].filter(Boolean).join(", ");
  const location =
    profile.distanceKm !== null
      ? profile.distanceKm < 1
        ? "Less than 1 km away"
        : `${Math.round(profile.distanceKm)} km away`
      : profile.showExactLocation
        ? preciseLocation
        : "";

  return (
    <article
      className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-background text-left shadow-sm"
      aria-label={`${profile.displayName} match preview`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt={profile.displayName}
            fill
            sizes="(max-width: 639px) 100vw, 220px"
            className="object-cover"
          />
        ) : profile.bannerUrl ? (
          <Image
            src={profile.bannerUrl}
            alt=""
            fill
            sizes="(max-width: 639px) 100vw, 220px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-heading text-4xl font-bold text-muted-foreground">
            {initials}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-base font-bold">{profile.displayName}</p>
            {verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-primary text-white" aria-label="Verified" />}
          </div>
          <p className="truncate text-xs text-white/75">@{profile.username}</p>
          {location && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-white/85">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{location}</span>
            </p>
          )}
        </div>
      </div>

      <p className="min-h-[4.75rem] px-4 py-3 text-sm leading-6 text-muted-foreground">
        {profile.explanation}
      </p>
    </article>
  );
}
