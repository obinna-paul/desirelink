import Image from "next/image";
import Link from "next/link";
import type { Desire, Profile } from "@prisma/client";
import {
  CalendarDays,
  Camera,
  Heart,
  LayoutGrid,
  MapPin,
  MessageCircle,
  MessageCircleMore,
  Pencil,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import { PreferencesSummary } from "@/components/profile/preferences-summary";
import { EmptyProfileSection } from "@/components/profile/empty-profile-section";
import { VerificationBadge } from "@/components/profile/verification-badge";
import { ProfileSectionTab } from "@/components/profile/profile-section-tab";
import { ProfileSetupActions } from "@/components/profile/profile-setup-actions";
import { BannerUploader } from "@/components/profile/banner-uploader";
import { ShareProfileButton } from "@/components/profile/share-profile-button";
import { PostGridSection, GRID_CLASSNAME } from "@/components/profile/creator-content-grid";
import { EventGridTile } from "@/components/profile/profile-grid-tiles";
import { BlockButton } from "@/components/safety/block-button";
import { ReportDialog } from "@/components/safety/report-dialog";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { ALL_PROFILE_FIELD_NAMES, type ProfileFieldName } from "@/lib/circles";
import type { UpcomingEvent } from "@/lib/events";
import type { PostView } from "@/lib/posts";
import type { ReviewableContext, ReviewData, ReviewSummary } from "@/lib/reviews";

type ExplorerSection = "posts" | "going" | "reviews";

const EXPLORER_SECTIONS: { id: ExplorerSection; label: string; icon: LucideIcon }[] = [
  { id: "posts", label: "Posts", icon: LayoutGrid },
  { id: "going", label: "Going", icon: CalendarDays },
  { id: "reviews", label: "Reviews", icon: Star },
];

function normalizeSection(section?: string): ExplorerSection {
  return EXPLORER_SECTIONS.some((item) => item.id === section) ? (section as ExplorerSection) : "posts";
}

function sectionHref(profileHref: string, section: ExplorerSection) {
  return section === "posts" ? profileHref : `${profileHref}?section=${section}`;
}

export function ExplorerProfileView({
  profile,
  desires,
  posts,
  events = [],
  isOwner,
  profileHref,
  activeSection,
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
  events?: UpcomingEvent[];
  isOwner: boolean;
  profileHref: string;
  activeSection?: string;
  canMessage?: boolean;
  canModerate?: boolean;
  reviewSummary: ReviewSummary;
  reviews: ReviewData[];
  reviewableContexts?: ReviewableContext[];
  visibleProfileFields?: ProfileFieldName[];
}) {
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const visibleFieldSet = new Set<ProfileFieldName>(visibleProfileFields);
  const section = normalizeSection(activeSection);
  const accountTypeLabel = ACCOUNT_TYPE_OPTIONS.find((option) => option.value === profile.profileType)?.label;
  const showAvailability = visibleFieldSet.has("availability") && (isOwner || profile.openToChat || profile.openToMeet);

  const hasAboutContent =
    visibleFieldSet.has("identity") || visibleFieldSet.has("availability") || isOwner || desires.length > 0;

  return (
    <div className="theme-olive w-full min-w-0">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 md:gap-6">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card md:rounded-3xl">
          {isOwner ? (
            <BannerUploader bannerUrl={profile.bannerUrl} />
          ) : profile.bannerUrl ? (
            <div className="relative h-24 w-full sm:h-40">
              <Image src={profile.bannerUrl} alt="" fill sizes="(min-width: 1024px) 896px, 100vw" className="object-cover" />
            </div>
          ) : (
            <div className="h-16 w-full bg-muted sm:h-24" />
          )}

          <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
              <div className="relative -mt-10 flex shrink-0 flex-col items-center self-start sm:-mt-14 md:mt-0">
                <Avatar className="h-20 w-20 rounded-[26px] border-4 border-card bg-avatar-placeholder shadow-lift sm:h-24 sm:w-24 md:h-28 md:w-28">
                  <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                  <AvatarFallback className="rounded-[26px] text-lg md:text-2xl">{initials}</AvatarFallback>
                </Avatar>
                {profile.isVerified && (
                  <Badge variant="trust" className="label-caps -mt-2.5 shrink-0 whitespace-nowrap px-2.5">
                    Verified
                  </Badge>
                )}
                {isOwner && (
                  <Link
                    href="/profile/edit"
                    aria-label="Edit profile photo"
                    className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-foreground text-background hover:bg-foreground/90"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 truncate font-heading text-2xl font-semibold tracking-tight md:text-3xl">
                    {profile.displayName}
                  </h1>
                  <VerificationBadge profile={profile} />
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                  {accountTypeLabel && (
                    <Badge variant="outline" className="whitespace-nowrap">
                      {accountTypeLabel}
                    </Badge>
                  )}
                </div>

                {showAvailability && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={profile.openToChat ? "tint" : "outline"}
                      className="label-caps gap-1 whitespace-nowrap"
                    >
                      <MessageCircleMore className="h-3 w-3" aria-hidden="true" />
                      {profile.openToChat ? "Open to chat" : "Not open to chat"}
                    </Badge>
                    <Badge
                      variant={profile.openToMeet ? "tint" : "outline"}
                      className="label-caps gap-1 whitespace-nowrap"
                    >
                      <Users className="h-3 w-3" aria-hidden="true" />
                      {profile.openToMeet ? "Open to meet" : "Not open to meet"}
                    </Badge>
                  </div>
                )}

                {visibleFieldSet.has("location") && profile.showExactLocation && location && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" aria-hidden="true" /> {location}
                  </p>
                )}

                {profile.partner && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Heart className="h-4 w-4" aria-hidden="true" /> Linked with{" "}
                    <Link
                      href={`/profile/${profile.partner.username}`}
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      @{profile.partner.username}
                    </Link>
                  </p>
                )}

                <div className="mt-4 flex max-w-sm gap-2 rounded-2xl border border-border bg-muted p-2 text-center">
                  <div className="flex-1 rounded-xl bg-card px-2 py-2">
                    <p className="text-base font-semibold">{posts.length}</p>
                    <p className="label-caps text-[10px] text-muted-foreground">Posts</p>
                  </div>
                  <Link href={sectionHref(profileHref, "going")} className="flex-1 rounded-xl bg-card px-2 py-2 hover:bg-accent-tint">
                    <p className="text-base font-semibold">{events.length}</p>
                    <p className="label-caps text-[10px] text-muted-foreground">Going</p>
                  </Link>
                  <Link href={sectionHref(profileHref, "reviews")} className="flex-1 rounded-xl bg-card px-2 py-2 hover:bg-accent-tint">
                    <p className="text-base font-semibold">
                      {reviewSummary.totalCount > 0 ? reviewSummary.averageRating.toFixed(1) : "—"}
                    </p>
                    <p className="label-caps text-[10px] text-muted-foreground">Rating</p>
                  </Link>
                </div>

                {profile.bio && (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{profile.bio}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isOwner ? (
                    <>
                      <Button asChild variant="outline" className="h-11 flex-1 gap-1.5 sm:flex-none">
                        <Link href="/profile/edit">
                          <Pencil className="h-4 w-4" aria-hidden="true" /> Edit profile
                        </Link>
                      </Button>
                      <ShareProfileButton profileHref={profileHref} displayName={profile.displayName} />
                    </>
                  ) : (
                    <>
                      {canMessage && (
                        <Button asChild variant="outline" className="h-11 flex-1 gap-1.5 sm:flex-none">
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
                    </>
                  )}
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="mt-4">
                <ProfileSetupActions
                  profile={{ ...profile, _count: { desires: desires.length } }}
                />
              </div>
            )}

            {hasAboutContent && (
              <details className="group mt-4 rounded-2xl border border-border bg-muted/60 px-4 py-1 open:pb-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  About {profile.displayName}
                  <span aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="flex flex-col gap-4">
                  {visibleFieldSet.has("identity") && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-card px-3 py-2">
                        <p className="text-xs text-muted-foreground">Gender</p>
                        <p className="text-sm font-medium">{profile.gender || "Unspecified"}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-card px-3 py-2">
                        <p className="text-xs text-muted-foreground">Orientation</p>
                        <p className="text-sm font-medium">{profile.orientation || "Unspecified"}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Preferences
                    </h2>
                    <div className="mt-2">
                      <PreferencesSummary desires={desires} isOwner={isOwner} />
                    </div>
                  </div>
                </div>
              </details>
            )}
          </div>
        </section>

        <nav
          aria-label="Profile sections"
          className="-mx-3 flex min-w-0 gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:gap-6 md:border-b md:border-border md:px-0 md:pb-0"
        >
          {EXPLORER_SECTIONS.map((item) => (
            <ProfileSectionTab
              key={item.id}
              href={sectionHref(profileHref, item.id)}
              label={item.label}
              icon={item.icon}
              isActive={section === item.id}
            />
          ))}
        </nav>

        {section === "posts" && (
          <PostGridSection
            posts={posts}
            emptyTitle="No posts yet"
            emptyDescription={isOwner ? "Share your first post from the Create tab." : "This profile hasn't posted anything yet."}
          />
        )}

        {section === "going" && (
          events.length > 0 ? (
            <div className={GRID_CLASSNAME}>
              {events.map((event) => (
                <EventGridTile key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyProfileSection
              title="Not going to anything yet"
              description={
                isOwner
                  ? "RSVP to an event and it'll show up here."
                  : "This profile isn't attending any public events right now."
              }
              actionHref={isOwner ? "/events" : undefined}
              actionLabel={isOwner ? "Find events" : undefined}
            />
          )
        )}

        {section === "reviews" && (
          reviewSummary.totalCount > 0 ? (
            <ReviewsSection summary={reviewSummary} reviews={reviews} />
          ) : (
            <EmptyProfileSection
              title="No reviews yet"
              description="Reviews appear here after you've shared an event with someone who leaves you one."
            />
          )
        )}
      </div>
    </div>
  );
}
