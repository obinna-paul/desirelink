import Link from "next/link";
import type { Desire, Profile } from "@prisma/client";
import {
  Award,
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  Heart,
  MapPin,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DesireMapSummary } from "@/components/profile/desire-map-summary";
import { PostList } from "@/components/posts/post-list";
import { BlockButton } from "@/components/safety/block-button";
import { ReportDialog } from "@/components/safety/report-dialog";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { TierMenu } from "@/components/provider/TierMenu";
import { ServiceListingMenu } from "@/components/provider/ServiceListingMenu";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { ProfileViewersPanel } from "@/components/premium/profile-viewers-panel";
import { ALL_PROFILE_FIELD_NAMES, type ProfileFieldName } from "@/lib/circles";
import type { PostView } from "@/lib/posts";
import type { PublicTierView } from "@/lib/tiers";
import type { ServiceListingView } from "@/lib/service-listings";
import { isProviderProfileType } from "@/lib/providers";
import type { ReviewableContext, ReviewData, ReviewSummary } from "@/lib/reviews";

function ProfileSectionTab({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center border-b-2 px-2 text-sm font-semibold transition-colors",
        isActive
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function ProfileView({
  profile,
  desires,
  posts,
  tiers,
  serviceListings = [],
  isOwner,
  isPremium = false,
  profileHref,
  activeSection = "about",
  canMessage = false,
  canModerate = false,
  reviewSummary,
  reviews,
  reviewableContexts = [],
  visibleProfileFields = ALL_PROFILE_FIELD_NAMES,
}: {
  profile: Profile & {
    partner: { username: string; displayName: string; avatarUrl: string } | null;
  };
  desires: Desire[];
  posts: PostView[];
  tiers: PublicTierView[];
  serviceListings?: ServiceListingView[];
  isOwner: boolean;
  isPremium?: boolean;
  profileHref: string;
  activeSection?: "about" | "posts";
  canMessage?: boolean;
  canModerate?: boolean;
  reviewSummary?: ReviewSummary;
  reviews?: ReviewData[];
  reviewableContexts?: ReviewableContext[];
  visibleProfileFields?: ProfileFieldName[];
}) {
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const visibleFieldSet = new Set<ProfileFieldName>(visibleProfileFields);
  const isCreatorProfile = profile.profileType === "CREATOR";
  const isProvider = isProviderProfileType(profile.profileType);
  const section = isCreatorProfile ? activeSection : "about";

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
              {isPremium && <PremiumBadge />}
              {isCreatorProfile && (
                <Badge variant="neon" className="gap-1">
                  <Sparkles className="h-3 w-3" /> Creator
                </Badge>
              )}
              {profile.profileType === "PAIR" && (
                <Badge variant="secondary" className="gap-1">
                  <Heart className="h-3 w-3" /> Pair
                </Badge>
              )}
              {profile.profileType === "SERVICE_PROVIDER" && (
                <Badge variant="secondary" className="gap-1">
                  <Briefcase className="h-3 w-3" /> Service provider
                </Badge>
              )}
              {profile.isTrustedMember && (
                <Badge variant="neon" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Trusted
                </Badge>
              )}
              {profile.isVerified && (
                <Badge variant="outline" className="gap-1">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </Badge>
              )}
              {profile.isVerifiedCreator && (
                <Badge variant="outline" className="gap-1">
                  <Award className="h-3 w-3" /> Verified creator
                </Badge>
              )}
              {profile.isVerifiedHost && (
                <Badge variant="outline" className="gap-1">
                  <CalendarCheck className="h-3 w-3" /> Verified host
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {visibleFieldSet.has("location") && location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {location}
              </p>
            )}
            {profile.partner && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="h-3 w-3" /> Partnered with{" "}
                <Link
                  href={`/profile/${profile.partner.username}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  @{profile.partner.username}
                </Link>
              </p>
            )}
          </div>
        </div>

        {isOwner ? (
          <Button asChild variant="outline">
            <Link href="/profile/edit">
              <Pencil className="h-4 w-4" /> Edit Profile
            </Link>
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {canMessage && (
              <Button asChild variant="outline" className="gap-1.5">
                <Link href={`/messages?with=${profile.username}`}>
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> Message
                </Link>
              </Button>
            )}
            {reviewableContexts.length > 0 && (
              <ReviewDialog
                revieweeId={profile.id}
                revieweeName={profile.displayName}
                contexts={reviewableContexts}
              />
            )}
            {canModerate && (
              <>
                <ReportDialog targetType="profile" targetId={profile.id} />
                <BlockButton profileId={profile.id} initiallyBlocked={false} />
              </>
            )}
          </div>
        )}
      </div>

      {isProvider && (tiers.length > 0 || isOwner) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {profile.displayName}&apos;s tiers
          </h2>
          <TierMenu providerId={profile.id} tiers={tiers} isOwner={isOwner} />
        </div>
      )}

      {profile.profileType === "SERVICE_PROVIDER" && (serviceListings.length > 0 || isOwner) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Services</h2>
          {serviceListings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No services listed yet.
            </div>
          ) : (
            <ServiceListingMenu listings={serviceListings} />
          )}
        </div>
      )}

      {isCreatorProfile && (
        <div className="flex gap-6 border-b border-border/60">
          <ProfileSectionTab href={profileHref} label="About" isActive={section === "about"} />
          <ProfileSectionTab
            href={`${profileHref}?section=posts`}
            label="Posts"
            isActive={section === "posts"}
          />
        </div>
      )}

      {section === "posts" ? (
        <PostList
          posts={posts}
          showAuthor={false}
          emptyMessage={isOwner ? "You haven't published anything yet." : "No posts yet."}
        />
      ) : (
        <>
          {visibleFieldSet.has("bio") && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Bio
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {profile.bio || "No bio yet."}
              </p>
            </div>
          )}

          {(visibleFieldSet.has("identity") || visibleFieldSet.has("availability")) && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Details
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleFieldSet.has("identity") && (
                  <>
                    <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                      <p className="text-xs text-muted-foreground">Gender</p>
                      <p className="text-sm font-medium">{profile.gender || "Unspecified"}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                      <p className="text-xs text-muted-foreground">Orientation</p>
                      <p className="text-sm font-medium">{profile.orientation || "Unspecified"}</p>
                    </div>
                  </>
                )}
                {visibleFieldSet.has("availability") && (
                  <>
                    <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                      <p className="text-xs text-muted-foreground">Chat</p>
                      <p className="text-sm font-medium">
                        {profile.openToChat ? "Open to chat" : "Not open to chat"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                      <p className="text-xs text-muted-foreground">Meet</p>
                      <p className="text-sm font-medium">
                        {profile.openToMeet ? "Open to meet" : "Not open to meet"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {profile.profileType === "SERVICE_PROVIDER" && profile.serviceCategories.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Services offered
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.serviceCategories.map((category) => (
                  <Badge key={category} variant="outline">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <DesireMapSummary desires={desires} isOwner={isOwner} />

          {reviewSummary && reviews && (
            <ReviewsSection summary={reviewSummary} reviews={reviews} />
          )}

          {isOwner && <ProfileViewersPanel isPremium={isPremium} />}
        </>
      )}
    </div>
  );
}
