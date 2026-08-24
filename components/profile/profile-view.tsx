import Link from "next/link";
import type { Desire, Profile } from "@prisma/client";
import {
  Award,
  BadgeCheck,
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
import { TierSubscribeCard } from "@/components/profile/tier-subscribe-card";
import { BlockButton } from "@/components/safety/block-button";
import { ReportDialog } from "@/components/safety/report-dialog";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { ALL_PROFILE_FIELD_NAMES, type ProfileFieldName } from "@/lib/circles";
import type { PostView } from "@/lib/posts";
import type { PublicTierView } from "@/lib/tiers";
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
        "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
        isActive
          ? "border-transparent bg-gradient-to-r from-neon-pink to-neon-cyan text-background"
          : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
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
  isOwner,
  profileHref,
  activeSection = "about",
  canMessage = false,
  canModerate = false,
  reviewSummary,
  reviews,
  reviewableContexts = [],
  visibleProfileFields = ALL_PROFILE_FIELD_NAMES,
}: {
  profile: Profile;
  desires: Desire[];
  posts: PostView[];
  tiers: PublicTierView[];
  isOwner: boolean;
  profileHref: string;
  activeSection?: "about" | "posts" | "membership";
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
  const showMembershipTab = profile.isCreator && (tiers.length > 0 || isOwner);
  const section = profile.isCreator
    ? activeSection === "membership" && !showMembershipTab
      ? "about"
      : activeSection
    : "about";

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

      {profile.isCreator && (
        <div className="flex gap-2">
          <ProfileSectionTab href={profileHref} label="About" isActive={section === "about"} />
          <ProfileSectionTab
            href={`${profileHref}?section=posts`}
            label="Posts"
            isActive={section === "posts"}
          />
          {showMembershipTab && (
            <ProfileSectionTab
              href={`${profileHref}?section=membership`}
              label="Membership"
              isActive={section === "membership"}
            />
          )}
        </div>
      )}

      {section === "posts" ? (
        <PostList
          posts={posts}
          showAuthor={false}
          emptyMessage={isOwner ? "You haven't published anything yet." : "No posts yet."}
        />
      ) : section === "membership" ? (
        <div className="flex flex-col gap-3">
          {isOwner && (
            <p className="text-sm text-muted-foreground">
              Manage pricing, capacity, and applications from your{" "}
              <Link href="/creator-dashboard?tab=tiers" className="text-neon-pink hover:underline">
                creator dashboard
              </Link>
              .
            </p>
          )}
          {tiers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              No membership tiers yet.
            </div>
          ) : (
            tiers.map((tier) => <TierSubscribeCard key={tier.id} tier={tier} />)
          )}
        </div>
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

          <DesireMapSummary desires={desires} isOwner={isOwner} />

          {reviewSummary && reviews && (
            <ReviewsSection summary={reviewSummary} reviews={reviews} />
          )}
        </>
      )}
    </div>
  );
}
