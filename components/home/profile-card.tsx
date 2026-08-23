import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ProfileCardData } from "@/lib/home-feed";
import { AVAILABILITY_STATUS_LABELS } from "@/lib/availability-options";

export function ProfileCard({ profile }: { profile: ProfileCardData }) {
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const visibleDesires = profile.desires.slice(0, 3);
  const extraDesireCount = profile.desires.length - visibleDesires.length;
  const activeStatus = profile.availabilityStatuses[0];

  return (
    <Link
      href={`/profile/${profile.username}`}
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-neon-pink/60"
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-12 w-12 border border-border">
            <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {activeStatus && (
            <span
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-neon-cyan motion-safe:animate-pulse"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{profile.displayName}</p>
            {profile.isCreator && (
              <Sparkles
                role="img"
                aria-label="Creator"
                className="h-3.5 w-3.5 shrink-0 text-neon-pink"
              />
            )}
            {profile.isCouple && (
              <Heart role="img" aria-label="Couple" className="h-3.5 w-3.5 shrink-0 text-neon-cyan" />
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
          {location && <p className="truncate text-xs text-muted-foreground">{location}</p>}
        </div>
      </div>

      {activeStatus && (
        <Badge variant="neon" className="w-fit gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-background/80 motion-safe:animate-pulse" />
          {AVAILABILITY_STATUS_LABELS[activeStatus.status]}
        </Badge>
      )}

      {visibleDesires.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
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
