import Image from "next/image";
import Link from "next/link";
import type { Desire, Profile } from "@prisma/client";
import {
  Briefcase,
  CalendarDays,
  Camera,
  Heart,
  LayoutGrid,
  LineChart,
  Lock,
  MessageCircle,
  Pencil,
  Star,
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
import { BannerUploader } from "@/components/profile/banner-uploader";
import { ShareProfileButton } from "@/components/profile/share-profile-button";
import { PostGridSection, ServiceGridSection, GRID_CLASSNAME } from "@/components/profile/creator-content-grid";
import { EventGridTile } from "@/components/profile/profile-grid-tiles";
import { BlockButton } from "@/components/safety/block-button";
import { ReportDialog } from "@/components/safety/report-dialog";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { TierMenu } from "@/components/provider/TierMenu";
import { SendHeartsButton } from "@/components/hearts/send-hearts-button";
import { ProfileViewersPanel } from "@/components/premium/profile-viewers-panel";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { ALL_PROFILE_FIELD_NAMES, type ProfileFieldName } from "@/lib/circles";
import type { UpcomingEvent } from "@/lib/events";
import type { PostView } from "@/lib/posts";
import type { PublicTierView } from "@/lib/tiers";
import type { ServiceListingView } from "@/lib/service-listings";
import type { ReviewableContext, ReviewData, ReviewSummary } from "@/lib/reviews";
import type { CreatorStats } from "@/lib/creator";

type CreatorSection = "free" | "premium" | "events" | "services" | "reviews";

const CREATOR_SECTIONS: { id: CreatorSection; label: string; icon: LucideIcon }[] = [
  { id: "free", label: "Free", icon: LayoutGrid },
  { id: "premium", label: "Premium", icon: Lock },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "services", label: "Services", icon: Briefcase },
  { id: "reviews", label: "Reviews", icon: Star },
];

function normalizeSection(section?: string): CreatorSection {
  return CREATOR_SECTIONS.some((item) => item.id === section) ? (section as CreatorSection) : "free";
}

function sectionHref(profileHref: string, section: CreatorSection) {
  return section === "free" ? profileHref : `${profileHref}?section=${section}`;
}

export function CreatorProfileView({
  profile,
  desires,
  posts,
  tiers,
  serviceListings = [],
  events = [],
  isOwner,
  isPremium = false,
  profileHref,
  activeSection,
  canMessage = false,
  canModerate = false,
  reviewSummary,
  reviews,
  reviewableContexts = [],
  visibleProfileFields = ALL_PROFILE_FIELD_NAMES,
  viewerHeartsBalance = 0,
  stats,
}: {
  profile: Profile & {
    partner: { username: string; displayName: string; avatarUrl: string } | null;
  };
  desires: Desire[];
  posts: PostView[];
  tiers: PublicTierView[];
  serviceListings?: ServiceListingView[];
  events?: UpcomingEvent[];
  isOwner: boolean;
  isPremium?: boolean;
  profileHref: string;
  activeSection?: string;
  canMessage?: boolean;
  canModerate?: boolean;
  reviewSummary: ReviewSummary;
  reviews: ReviewData[];
  reviewableContexts?: ReviewableContext[];
  visibleProfileFields?: ProfileFieldName[];
  viewerHeartsBalance?: number;
  stats: CreatorStats;
}) {
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const visibleFieldSet = new Set<ProfileFieldName>(visibleProfileFields);
  const section = normalizeSection(activeSection);
  const accountTypeLabel = ACCOUNT_TYPE_OPTIONS.find((option) => option.value === profile.profileType)?.label;

  const freePosts = posts.filter((post) => !post.isSubscriberOnly);
  const premiumPosts = posts.filter((post) => post.isSubscriberOnly);

  const hasAboutContent =
    visibleFieldSet.has("identity") ||
    visibleFieldSet.has("availability") ||
    tiers.length > 0 ||
    isOwner ||
    profile.serviceCategories.length > 0 ||
    desires.length > 0 ||
    isOwner;

  return (
    <div className="theme-clay w-full min-w-0">
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
              <Badge variant="tint" className="label-caps -mt-2.5 shrink-0 whitespace-nowrap px-2.5">
                {accountTypeLabel ?? "Creator"}
              </Badge>
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
                {isPremium && <PremiumBadge />}
              </div>

              <p className="mt-1 text-sm text-muted-foreground">@{profile.username}</p>

              {(accountTypeLabel || location) && (
                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-foreground">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-tint text-primary">
                    <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {accountTypeLabel}
                  {accountTypeLabel && location && visibleFieldSet.has("location") && profile.showExactLocation && (
                    <span className="text-muted-foreground"> · </span>
                  )}
                  {visibleFieldSet.has("location") && profile.showExactLocation && location}
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
                <div className="flex-1 rounded-xl bg-card px-2 py-2">
                  <p className="text-base font-semibold">{stats.subscriberCount}</p>
                  <p className="label-caps text-[10px] text-muted-foreground">Subscribers</p>
                </div>
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
                    <SendHeartsButton providerId={profile.id} initialBalance={viewerHeartsBalance} />
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
            <Link
              href="/creator-dashboard"
              className="mt-4 flex items-center gap-3 rounded-2xl border border-accent-tint-border bg-accent-tint/50 p-3.5 transition-colors hover:bg-accent-tint sm:p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <LineChart className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Professional dashboard</span>
                <span className="block text-xs text-muted-foreground">
                  {stats.subscriberCount} subscribers · {stats.profileViews.toLocaleString()} total profile views
                </span>
              </span>
            </Link>
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
                {(visibleFieldSet.has("identity") || visibleFieldSet.has("availability")) && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {visibleFieldSet.has("identity") && (
                      <>
                        <div className="rounded-xl border border-border bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Gender</p>
                          <p className="text-sm font-medium">{profile.gender || "Unspecified"}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Orientation</p>
                          <p className="text-sm font-medium">{profile.orientation || "Unspecified"}</p>
                        </div>
                      </>
                    )}
                    {visibleFieldSet.has("availability") && (
                      <>
                        <div className="rounded-xl border border-border bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Chat</p>
                          <p className="text-sm font-medium">
                            {profile.openToChat ? "Open to chat" : "Not open to chat"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Meet</p>
                          <p className="text-sm font-medium">
                            {profile.openToMeet ? "Open to meet" : "Not open to meet"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {(tiers.length > 0 || isOwner) && (
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Memberships</h2>
                    <div className="mt-2">
                      <TierMenu providerId={profile.id} tiers={tiers} isOwner={isOwner} />
                    </div>
                  </div>
                )}

                {profile.serviceCategories.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service interests</h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.serviceCategories.map((category) => (
                        <Badge key={category} variant="outline">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <PreferencesSummary desires={desires} isOwner={isOwner} />
              </div>
            </details>
          )}
        </div>
      </section>

      <nav
        aria-label="Profile sections"
        className="-mx-3 flex min-w-0 gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:gap-6 md:border-b md:border-border md:px-0 md:pb-0"
      >
        {CREATOR_SECTIONS.map((item) => (
          <ProfileSectionTab
            key={item.id}
            href={sectionHref(profileHref, item.id)}
            label={item.label}
            icon={item.icon}
            isActive={section === item.id}
          />
        ))}
      </nav>

      {section === "free" && (
        <PostGridSection
          posts={freePosts}
          emptyTitle="No free posts yet"
          emptyDescription={isOwner ? "Posts you don't mark as subscriber-only will show up here." : "This creator hasn't shared any free posts yet."}
        />
      )}

      {section === "premium" && (
        <PostGridSection
          posts={premiumPosts}
          emptyTitle="No premium posts yet"
          emptyDescription={isOwner ? "Mark a post as subscriber-only from Create to list it here." : "This creator hasn't posted any subscriber-only content yet."}
        />
      )}

      {section === "events" && (
        events.length > 0 ? (
          <div className={GRID_CLASSNAME}>
            {events.map((event) => (
              <EventGridTile key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyProfileSection
            title="No events yet"
            description={
              isOwner
                ? "You are not hosting any public events yet. Create one from the Create tab."
                : "This profile is not hosting any public events."
            }
          />
        )
      )}

      {section === "services" && (
        <ServiceGridSection
          listings={serviceListings}
          providerUsername={profile.username}
          isOwner={isOwner}
          emptyTitle="No services yet"
          emptyDescription={
            isOwner
              ? "Create a service listing when you are ready to offer bookings from your profile."
              : "This profile has not listed any services."
          }
          emptyActionHref={isOwner ? "/services/new" : undefined}
          emptyActionLabel={isOwner ? "Create service" : undefined}
        />
      )}

      {section === "reviews" && (
        reviewSummary.totalCount > 0 ? (
          <ReviewsSection summary={reviewSummary} reviews={reviews} />
        ) : (
          <EmptyProfileSection
            title="No reviews yet"
            description="Reviews will appear here after completed bookings, RSVPs, or eligible interactions."
          />
        )
      )}

      {isOwner && (
        <div className="hidden xl:block">
          <ProfileViewersPanel isPremium={isPremium} />
        </div>
      )}
      </div>
    </div>
  );
}
