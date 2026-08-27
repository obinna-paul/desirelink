import Link from "next/link";
import { Award, BadgeCheck, Briefcase, CalendarCheck, Heart, ShieldCheck, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PremiumBadge } from "@/components/premium/premium-badge";
import type { ProfileCardData } from "@/lib/home-feed";
import { AVAILABILITY_STATUS_LABELS } from "@/lib/availability-options";

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
  const visibleDesires = profile.desires.slice(0, 3);
  const extraDesireCount = profile.desires.length - visibleDesires.length;
  const activeStatus = profile.availabilityStatuses[0];
  const premium = profile.premiumSubscription;
  const isPremium = Boolean(premium && premium.status === "active" && premium.currentPeriodEnd > new Date());

  return (
    <Link
      href={`/profile/${profile.username}`}
      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition-[transform,border-color,box-shadow] hover:border-primary/80 hover:shadow-lift md:rounded-xl md:p-4 md:hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-[52px] w-[52px] border border-border bg-secondary md:h-12 md:w-12">
            <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {activeStatus && (
            <span
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-neon-cyan shadow-[0_0_8px_hsl(var(--neon-cyan)/0.6)] motion-safe:animate-pulse"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{profile.displayName}</p>
            {isPremium && <PremiumBadge className="px-1.5 py-0.5 text-[10px]" />}
            {profile.profileType === "CREATOR" && (
              <Sparkles
                role="img"
                aria-label="Creator"
                className="h-3.5 w-3.5 shrink-0 text-neon-pink"
              />
            )}
            {profile.profileType === "PAIR" && (
              <Heart role="img" aria-label="Pair" className="h-3.5 w-3.5 shrink-0 text-neon-cyan" />
            )}
            {profile.profileType === "SERVICE_PROVIDER" && (
              <Briefcase
                role="img"
                aria-label="Service provider"
                className="h-3.5 w-3.5 shrink-0 text-neon-cyan"
              />
            )}
            {profile.isTrustedMember ? (
              <ShieldCheck
                role="img"
                aria-label="Trusted member"
                className="h-3.5 w-3.5 shrink-0 text-neon-cyan"
              />
            ) : (
              profile.isVerified && (
                <BadgeCheck
                  role="img"
                  aria-label="Verified"
                  className="h-3.5 w-3.5 shrink-0 text-neon-pink"
                />
              )
            )}
            {profile.isVerifiedCreator && (
              <Award
                role="img"
                aria-label="Verified creator"
                className="h-3.5 w-3.5 shrink-0 text-neon-pink"
              />
            )}
            {profile.isVerifiedHost && (
              <CalendarCheck
                role="img"
                aria-label="Verified host"
                className="h-3.5 w-3.5 shrink-0 text-neon-cyan"
              />
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
          {locationLabel && <p className="truncate text-xs text-muted-foreground">{locationLabel}</p>}
        </div>
      </div>

      {typeof matchScore === "number" && (
        <Badge variant="neon" className="w-fit">
          {matchScore}% match
        </Badge>
      )}

      {activeStatus && (
        <Badge variant="neon" className="w-fit gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-background/80 motion-safe:animate-pulse" />
          {AVAILABILITY_STATUS_LABELS[activeStatus.status]}
        </Badge>
      )}

      {visibleDesires.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {visibleDesires.map((desire) => (
            <Badge key={desire.id} variant="outline">
              {desire.category}
            </Badge>
          ))}
          {extraDesireCount > 0 && (
            <Badge variant="outline" className="text-muted-foreground">
              +{extraDesireCount} more
            </Badge>
          )}
        </div>
      )}
    </Link>
  );
}
