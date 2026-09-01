import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, MapPin, Radio } from "lucide-react";

import type { ProfileCardData } from "@/lib/home-feed";
import { AVAILABILITY_STATUS_LABELS } from "@/lib/availability-options";
import { getPreferenceLabel } from "@/lib/desire-options";

export function ProfileCard({
  profile,
  matchScore,
}: {
  profile: ProfileCardData;
  matchScore?: number;
}) {
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const preciseLocation = [profile.city, profile.country].filter(Boolean).join(", ");
  const distanceLabel =
    typeof profile.distanceKm === "number"
      ? profile.distanceKm < 1
        ? "Less than 1 km away"
        : `${Math.round(profile.distanceKm)} km away`
      : null;
  const locationLabel = distanceLabel ?? (profile.showExactLocation ? preciseLocation : "");
  const visibleDesires = profile.desires.slice(0, 2);
  const activeStatus = profile.availabilityStatuses[0];

  return (
    <Link
      href={`/profile/${profile.username}`}
      className="group min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card transition-[border-color,box-shadow,transform] hover:border-foreground/20 hover:shadow-lift md:hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary md:aspect-[5/4]">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt={profile.displayName}
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 1279px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : profile.bannerUrl ? (
          <Image
            src={profile.bannerUrl}
            alt=""
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 1279px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl font-semibold text-muted-foreground md:text-4xl">
            {initials}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          {typeof matchScore === "number" && (
            <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
              {matchScore}% match
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3 text-white md:p-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-semibold md:text-base">{profile.displayName}</p>
            {(profile.isVerified || profile.isTrustedMember || profile.isVerifiedCreator || profile.isVerifiedHost) && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-white" aria-label="Verified" />
            )}
          </div>
          <p className="truncate text-[11px] text-white/75 md:text-xs">@{profile.username}</p>
          {locationLabel && (
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-white/80 md:text-xs">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{locationLabel}</span>
            </p>
          )}
        </div>
      </div>

      <div className="hidden min-h-12 items-center gap-2 px-3 py-2.5 sm:flex">
        {activeStatus ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
            <Radio className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
            <span className="truncate">{AVAILABILITY_STATUS_LABELS[activeStatus.status]}</span>
          </span>
        ) : visibleDesires.length > 0 ? (
          <span className="truncate text-xs text-muted-foreground">
            {visibleDesires.map((desire) => getPreferenceLabel(desire.category)).join(" · ")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">View profile</span>
        )}
        {activeStatus && visibleDesires.length > 0 && (
          <span className="ml-auto truncate text-xs text-muted-foreground">
            {getPreferenceLabel(visibleDesires[0].category)}
          </span>
        )}
      </div>
      {activeStatus && (
        <div className="flex min-h-9 items-center gap-1.5 px-2.5 py-2 text-[10px] font-medium sm:hidden">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="truncate">{AVAILABILITY_STATUS_LABELS[activeStatus.status]}</span>
        </div>
      )}
    </Link>
  );
}
