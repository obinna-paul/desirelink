import Link from "next/link";
import type { Desire, Profile } from "@prisma/client";
import { Heart, MapPin, Pencil, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DesireMapSummary } from "@/components/profile/desire-map-summary";

export function ProfileView({
  profile,
  desires,
  isOwner,
}: {
  profile: Profile;
  desires: Desire[];
  isOwner: boolean;
}) {
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border border-border">
            <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{profile.displayName}</h1>
              {profile.isCreator && (
                <Badge variant="neon" className="gap-1">
                  <Sparkles className="h-3 w-3" /> Creator
                </Badge>
              )}
              {profile.isCouple && (
                <Badge variant="secondary" className="gap-1">
                  <Heart className="h-3 w-3" /> Couple
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {location}
              </p>
            )}
          </div>
        </div>

        {isOwner && (
          <Button asChild variant="outline">
            <Link href="/profile/edit">
              <Pencil className="h-4 w-4" /> Edit Profile
            </Link>
          </Button>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Bio
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
          {profile.bio || "No bio yet."}
        </p>
      </div>

      <DesireMapSummary desires={desires} isOwner={isOwner} />
    </div>
  );
}
