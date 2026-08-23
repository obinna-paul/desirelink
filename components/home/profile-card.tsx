import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ProfileCardData } from "@/lib/home-feed";

export function ProfileCard({ profile }: { profile: ProfileCardData }) {
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const visibleDesires = profile.desires.slice(0, 3);
  const extraDesireCount = profile.desires.length - visibleDesires.length;

  return (
    <Link
      href={`/profile/${profile.username}`}
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-neon-pink/60"
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border border-border">
          <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{profile.displayName}</p>
            {profile.isCreator && (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-neon-pink" aria-label="Creator" />
            )}
            {profile.isCouple && (
              <Heart className="h-3.5 w-3.5 shrink-0 text-neon-cyan" aria-label="Couple" />
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
          {location && <p className="truncate text-xs text-muted-foreground">{location}</p>}
        </div>
      </div>

      {visibleDesires.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleDesires.map((desire) => (
            <Badge key={desire.id} variant="outline" className="text-[11px]">
              {desire.category}
            </Badge>
          ))}
          {extraDesireCount > 0 && (
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              +{extraDesireCount} more
            </Badge>
          )}
        </div>
      )}
    </Link>
  );
}
