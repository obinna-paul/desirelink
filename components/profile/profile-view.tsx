import Image from "next/image";
import Link from "next/link";
import type { Profile } from "@prisma/client";
import {
  BriefcaseBusiness,
  CalendarDays,
  Ellipsis,
  LayoutGrid,
  LockKeyhole,
  MapPin,
  Star,
  type LucideIcon,
} from "lucide-react";

import { BannerUploader } from "@/components/profile/banner-uploader";
import { EmptyProfileSection } from "@/components/profile/empty-profile-section";
import {
  PostGridSection,
  ServiceGridSection,
} from "@/components/profile/creator-content-grid";
import { InviteButton } from "@/components/profile/invite-button";
import { ProfileAvatarEditor } from "@/components/profile/profile-avatar-editor";
import { ProfileSectionTab } from "@/components/profile/profile-section-tab";
import { ProfileSetupActions } from "@/components/profile/profile-setup-actions";
import { ProfileSubscribeButton } from "@/components/profile/profile-subscribe-button";
import { ShareProfileButton } from "@/components/profile/share-profile-button";
import { SwipeableSection } from "@/components/profile/swipeable-section";
import { VerificationBadge } from "@/components/profile/verification-badge";
import type { PresenceStatus } from "@/lib/presence";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { BlockButton } from "@/components/safety/block-button";
import { ReportDialog } from "@/components/safety/report-dialog";
import { Button } from "@/components/ui/button";
import type { CreatorStats } from "@/lib/creator";
import type { PostView } from "@/lib/posts";
import type {
  ReviewableContext,
  ReviewData,
  ReviewSummary,
} from "@/lib/reviews";
import type { ServiceListingView } from "@/lib/service-listings";
import type { PublicTierView } from "@/lib/tiers";
import type { ProfileFieldName } from "@/lib/circles";

type ProfileSection = "posts" | "premium" | "services" | "reviews";

const PROFILE_SECTIONS: {
  id: ProfileSection;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "posts", label: "Posts", icon: LayoutGrid },
  { id: "premium", label: "Premium", icon: LockKeyhole },
  { id: "services", label: "Services", icon: BriefcaseBusiness },
  { id: "reviews", label: "Reviews", icon: Star },
];

function normalizeSection(section?: string): ProfileSection {
  return PROFILE_SECTIONS.some((item) => item.id === section)
    ? (section as ProfileSection)
    : "posts";
}

function sectionHref(profileHref: string, section: ProfileSection) {
  return section === "posts"
    ? profileHref
    : `${profileHref}?section=${section}`;
}

function ProfileStat({
  value,
  label,
  href,
}: {
  value: string | number;
  label: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="block text-base font-semibold leading-none text-foreground md:text-lg">
        {value}
      </span>
      <span className="mt-1 block text-[11px] text-muted-foreground md:text-xs">
        {label}
      </span>
    </>
  );

  return href ? (
    <Link
      href={href}
      className="min-w-0 px-2 py-1 text-center hover:text-primary"
    >
      {content}
    </Link>
  ) : (
    <div className="min-w-0 px-2 py-1 text-center">{content}</div>
  );
}

export function ProfileView({
  profile,
  posts,
  subscription,
  serviceListings,
  isOwner,
  isProvider,
  profileHref,
  activeSection,
  canMessage = false,
  canModerate = false,
  reviewSummary,
  reviews,
  reviewableContexts = [],
  visibleProfileFields,
  stats,
  presenceStatus = "offline",
  liveStreamId = null,
  viewerIsProvider = false,
}: {
  profile: Profile & {
    partner: {
      username: string;
      displayName: string;
      avatarUrl: string;
    } | null;
  };
  posts: PostView[];
  subscription: PublicTierView | null;
  serviceListings: ServiceListingView[];
  isOwner: boolean;
  isProvider: boolean;
  profileHref: string;
  activeSection?: string;
  canMessage?: boolean;
  canModerate?: boolean;
  reviewSummary: ReviewSummary;
  reviews: ReviewData[];
  reviewableContexts?: ReviewableContext[];
  visibleProfileFields: ProfileFieldName[];
  stats: CreatorStats;
  presenceStatus?: PresenceStatus;
  liveStreamId?: string | null;
  viewerIsProvider?: boolean;
}) {
  const section = normalizeSection(activeSection);
  const visibleFields = new Set(visibleProfileFields);
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const freePosts = posts.filter((post) => !post.isSubscriberOnly);
  const premiumPosts = posts.filter((post) => post.isSubscriberOnly);
  const subscriptionReviewContexts = isProvider
    ? reviewableContexts.filter(
        (context) => context.contextType === "transaction",
      )
    : reviewableContexts;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <section className="border-y border-border bg-card shadow-sm sm:rounded-2xl sm:border">
        {isOwner ? (
          <BannerUploader bannerUrl={profile.bannerUrl} />
        ) : profile.bannerUrl ? (
          <div className="relative aspect-[3/1] w-full overflow-hidden bg-muted sm:rounded-t-2xl md:aspect-[16/5]">
            <Image
              src={profile.bannerUrl}
              alt={`${profile.displayName}'s cover photo`}
              fill
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div className="aspect-[3/1] w-full bg-muted sm:rounded-t-2xl md:aspect-[16/5]" />
        )}

        <div className="px-4 pb-5 sm:px-6 md:px-8 md:pb-7">
          <div className="-mt-10 flex items-start gap-4 sm:-mt-12 md:-mt-14 md:gap-6">
            <ProfileAvatarEditor
              avatarUrl={profile.avatarUrl}
              displayName={profile.displayName}
              isOwner={isOwner}
              presenceStatus={presenceStatus}
              liveStreamId={liveStreamId}
            />

            <div className="min-w-0 flex-1 pt-11 sm:pt-14 md:pt-16">
              {profile.displayName && (
                <p className="truncate text-sm text-muted-foreground">
                  {profile.username}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:ml-[9.5rem]">
            <h1 className="min-w-0 break-words font-heading text-xl font-semibold text-foreground sm:text-2xl md:text-3xl">
              {profile.displayName || profile.username}
            </h1>
            <VerificationBadge profile={profile} />
          </div>

          <div className="mt-4 grid max-w-xs grid-cols-3 divide-x divide-border sm:max-w-sm md:ml-[9.5rem] md:mt-4">
            <ProfileStat value={posts.length} label="Posts" />
            <ProfileStat value={stats.subscriberCount} label="Subscribers" />
            <ProfileStat
              value={
                reviewSummary.totalCount
                  ? reviewSummary.averageRating.toFixed(1)
                  : "—"
              }
              label="Rating"
              href={sectionHref(profileHref, "reviews")}
            />
          </div>

          <div className="mt-4 max-w-2xl md:ml-[9.5rem]">
            {profile.bio && (
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {profile.bio}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {visibleFields.has("location") &&
                profile.showExactLocation &&
                location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                    {location}
                  </span>
                )}
              {visibleFields.has("availability") && profile.openToChat && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />{" "}
                  Open to chat
                </span>
              )}
              {visibleFields.has("availability") && profile.openToMeet && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                  Open to plans
                </span>
              )}
            </div>

            {profile.partner && (
              <p className="mt-2 text-xs text-muted-foreground">
                Linked with{" "}
                <Link
                  href={`/profile/${profile.partner.username}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {profile.partner.username}
                </Link>
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              {isOwner ? (
                <>
                  <Button asChild size="sm" className="flex-1" variant="outline">
                    <Link href="/profile/edit">Edit profile</Link>
                  </Button>
                  {isProvider && (
                    <Button asChild size="sm" className="flex-1">
                      <Link href="/creator-dashboard">Dashboard</Link>
                    </Button>
                  )}
                  <ShareProfileButton
                    profileHref={profileHref}
                    displayName={profile.displayName}
                    size="sm"
                    className="sm:flex-1"
                  />
                </>
              ) : isProvider ? (
                <>
                  {canMessage && (
                    <Button asChild size="sm" className="flex-1">
                      <Link href={`/messages?with=${profile.username}`}>
                        Message
                      </Link>
                    </Button>
                  )}
                  {subscription && (
                    <ProfileSubscribeButton
                      providerId={profile.id}
                      subscription={subscription}
                      size="sm"
                      className="flex-1"
                    />
                  )}
                  <details className="relative">
                    <summary
                      aria-label="More profile actions"
                      className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted [&::-webkit-details-marker]:hidden"
                    >
                      <Ellipsis className="h-5 w-5" aria-hidden="true" />
                    </summary>
                    <div className="absolute right-0 top-12 z-30 flex min-w-48 flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-lift">
                      <ShareProfileButton
                        profileHref={profileHref}
                        displayName={profile.displayName}
                      />
                      {canModerate && (
                        <>
                          <ReportDialog
                            targetType="profile"
                            targetId={profile.id}
                          />
                          <BlockButton
                            profileId={profile.id}
                            initiallyBlocked={false}
                          />
                        </>
                      )}
                    </div>
                  </details>
                </>
              ) : (
                <>
                  {canMessage && (
                    <Button
                      asChild
                      className="h-10 min-w-32 flex-1 sm:flex-none"
                    >
                      <Link href={`/messages?with=${profile.username}`}>
                        Message
                      </Link>
                    </Button>
                  )}
                  {canMessage && viewerIsProvider && (
                    <InviteButton
                      recipientId={profile.id}
                      recipientDisplayName={profile.displayName}
                    />
                  )}
                  <details className="relative">
                    <summary
                      aria-label="More profile actions"
                      className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted [&::-webkit-details-marker]:hidden"
                    >
                      <Ellipsis className="h-5 w-5" aria-hidden="true" />
                    </summary>
                    <div className="absolute right-0 top-12 z-30 flex min-w-48 flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-lift">
                      <ShareProfileButton
                        profileHref={profileHref}
                        displayName={profile.displayName}
                      />
                      {canModerate && (
                        <>
                          <ReportDialog
                            targetType="profile"
                            targetId={profile.id}
                          />
                          <BlockButton
                            profileId={profile.id}
                            initiallyBlocked={false}
                          />
                        </>
                      )}
                    </div>
                  </details>
                </>
              )}
            </div>
          </div>

        </div>
      </section>

      <nav
        aria-label="Profile sections"
        className="sticky top-[var(--mobile-header-height,0px)] z-20 mt-3 grid grid-cols-5 border-y border-border bg-background/95 backdrop-blur md:static md:mt-6 md:flex md:border-x-0 md:border-t-0 md:bg-transparent md:backdrop-blur-0"
      >
        {PROFILE_SECTIONS.map((item) => (
          <ProfileSectionTab
            key={item.id}
            href={sectionHref(profileHref, item.id)}
            label={item.label}
            icon={item.icon}
            isActive={section === item.id}
          />
        ))}
      </nav>

      <SwipeableSection
        hrefs={PROFILE_SECTIONS.map((item) =>
          sectionHref(profileHref, item.id),
        )}
        currentIndex={PROFILE_SECTIONS.findIndex((item) => item.id === section)}
      >
        <div className="min-h-[18rem] py-3 md:py-5">
          {section === "posts" && (
            <PostGridSection
              posts={freePosts}
              sectionLabel="Posts"
              emptyTitle="No posts yet"
              emptyDescription={
                isOwner
                  ? "Your public posts will appear here."
                  : "This profile hasn't shared a public post yet."
              }
            />
          )}

          {section === "premium" && (
            <PostGridSection
              posts={premiumPosts}
              sectionLabel="Premium"
              emptyTitle="No premium posts yet"
              emptyDescription={
                isOwner
                  ? "Premium posts you publish will appear here."
                  : "This profile hasn't shared premium content yet."
              }
            />
          )}

          {section === "services" && (
            <ServiceGridSection
              listings={serviceListings}
              providerUsername={profile.username}
              isOwner={isOwner}
              emptyTitle="No services yet"
              emptyDescription={
                isOwner
                  ? "Services you list will appear here."
                  : "This profile has no active service listings."
              }
              emptyActionHref={isOwner ? "/services/new" : undefined}
              emptyActionLabel={isOwner ? "List a service" : undefined}
            />
          )}

          {section === "reviews" && (
            <div className="space-y-4">
              {!isOwner && subscriptionReviewContexts.length > 0 && (
                <div className="flex items-center justify-between gap-4 border-b border-border px-4 pb-4 sm:px-0">
                  <div>
                    <p className="text-sm font-semibold">Your experience</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Subscriber ratings are available after a successful
                      subscription.
                    </p>
                  </div>
                  <ReviewDialog
                    revieweeId={profile.id}
                    revieweeName={profile.displayName}
                    contexts={subscriptionReviewContexts}
                  />
                </div>
              )}
              {reviewSummary.totalCount ? (
                <ReviewsSection summary={reviewSummary} reviews={reviews} />
              ) : (
                <EmptyProfileSection
                  title="No reviews yet"
                  description="Verified subscriber ratings will appear here."
                />
              )}
            </div>
          )}
        </div>
      </SwipeableSection>

      {isOwner && (
        <div className="hidden md:block">
          <ProfileSetupActions profile={profile} />
        </div>
      )}
    </div>
  );
}
