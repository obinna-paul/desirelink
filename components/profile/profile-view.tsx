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
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PreferencesSummary } from "@/components/profile/preferences-summary";
import { PostList } from "@/components/posts/post-list";
import { BlockButton } from "@/components/safety/block-button";
import { ReportDialog } from "@/components/safety/report-dialog";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { TierMenu } from "@/components/provider/TierMenu";
import { SendHeartsButton } from "@/components/hearts/send-hearts-button";
import { isProviderProfileType } from "@/lib/provider-types";
import { ServiceListingMenu } from "@/components/provider/ServiceListingMenu";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { ProfileViewersPanel } from "@/components/premium/profile-viewers-panel";
import { EventGrid } from "@/components/events/event-grid";
import { ALL_PROFILE_FIELD_NAMES, type ProfileFieldName } from "@/lib/circles";
import type { UpcomingEvent } from "@/lib/events";
import type { PostView } from "@/lib/posts";
import type { PublicTierView } from "@/lib/tiers";
import type { ServiceListingView } from "@/lib/service-listings";
import type { ReviewableContext, ReviewData, ReviewSummary } from "@/lib/reviews";

type ProfileSection = "posts" | "services" | "events" | "about" | "reviews";

const PROFILE_SECTIONS: { id: ProfileSection; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "services", label: "Services" },
  { id: "events", label: "Events" },
  { id: "about", label: "About" },
  { id: "reviews", label: "Reviews" },
];

function normalizeSection(section?: string): ProfileSection {
  return PROFILE_SECTIONS.some((item) => item.id === section)
    ? (section as ProfileSection)
    : "posts";
}

function sectionHref(profileHref: string, section: ProfileSection) {
  return section === "posts" ? profileHref : `${profileHref}?section=${section}`;
}

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
        "inline-flex h-11 min-w-max items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors md:h-12 md:rounded-none md:border-b-2 md:px-2",
        isActive
          ? "bg-foreground text-background md:border-foreground md:bg-transparent md:text-foreground"
          : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground md:border-transparent md:bg-transparent"
      )}
    >
      {label}
    </Link>
  );
}

export function EmptyProfileSection({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/70 p-8 text-center shadow-sm md:rounded-xl md:p-10">
      <p className="font-heading text-lg font-semibold tracking-tight text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {actionHref && actionLabel && (
        <Button asChild className="mt-5">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}

export function ProfileView({
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
  reviewSummary?: ReviewSummary;
  reviews?: ReviewData[];
  reviewableContexts?: ReviewableContext[];
  visibleProfileFields?: ProfileFieldName[];
  viewerHeartsBalance?: number;
}) {
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const visibleFieldSet = new Set<ProfileFieldName>(visibleProfileFields);
  const section = normalizeSection(activeSection);
  const canShowReviews = Boolean(reviewSummary && reviews);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4 md:space-y-6">
        <section className="rounded-[28px] border border-border/70 bg-card p-4 shadow-sm md:rounded-2xl md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4 md:gap-5">
              <Avatar className="h-20 w-20 border border-border bg-secondary shadow-sm md:h-28 md:w-28">
                <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                <AvatarFallback className="text-lg md:text-2xl">{initials}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 truncate font-heading text-2xl font-semibold tracking-tight md:text-3xl">
                    {profile.displayName}
                  </h1>
                  {isPremium && <PremiumBadge />}
                  {profile.isTrustedMember && (
                    <Badge variant="neon" className="gap-1">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Trusted
                    </Badge>
                  )}
                  {profile.isVerified && (
                    <Badge variant="outline" className="gap-1">
                      <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Verified
                    </Badge>
                  )}
                  {profile.isVerifiedCreator && (
                    <Badge variant="outline" className="gap-1">
                      <Award className="h-3 w-3" aria-hidden="true" /> Content verified
                    </Badge>
                  )}
                  {profile.isVerifiedHost && (
                    <Badge variant="outline" className="gap-1">
                      <CalendarCheck className="h-3 w-3" aria-hidden="true" /> Host verified
                    </Badge>
                  )}
                </div>

                <p className="mt-1 text-sm text-muted-foreground">@{profile.username}</p>

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
              </div>
            </div>

            {isOwner ? (
              <Button asChild variant="outline" className="h-11 w-full shrink-0 sm:w-auto">
                <Link href="/profile/edit">
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Edit Profile
                </Link>
              </Button>
            ) : (
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                {canMessage && (
                  <Button asChild variant="outline" className="h-11 flex-1 gap-1.5 sm:flex-none">
                    <Link href={`/messages?with=${profile.username}`}>
                      <MessageCircle className="h-4 w-4" aria-hidden="true" /> Message
                    </Link>
                  </Button>
                )}
                {!isOwner && isProviderProfileType(profile.profileType) && (
                  <SendHeartsButton providerId={profile.id} initialBalance={viewerHeartsBalance} />
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

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-border/60 bg-background/55 p-2 text-center md:max-w-md">
            <div className="rounded-xl bg-card px-3 py-2">
              <p className="text-base font-semibold">{posts.length}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <div className="rounded-xl bg-card px-3 py-2">
              <p className="text-base font-semibold">{events.length}</p>
              <p className="text-xs text-muted-foreground">Events</p>
            </div>
            <div className="rounded-xl bg-card px-3 py-2">
              <p className="text-base font-semibold">{serviceListings.length}</p>
              <p className="text-xs text-muted-foreground">Services</p>
            </div>
          </div>
        </section>

        <nav
          aria-label="Profile sections"
          className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:gap-6 md:border-b md:border-border/70 md:px-0 md:pb-0"
        >
          {PROFILE_SECTIONS.map((item) => (
            <ProfileSectionTab
              key={item.id}
              href={sectionHref(profileHref, item.id)}
              label={item.label}
              isActive={section === item.id}
            />
          ))}
        </nav>

        {section === "posts" && (
          <PostList
            posts={posts}
            showAuthor={false}
            emptyMessage={isOwner ? "You have not published anything yet." : "No posts yet."}
          />
        )}

        {section === "services" && (
          serviceListings.length > 0 ? (
            <ServiceListingMenu listings={serviceListings} providerUsername={profile.username} isOwner={isOwner} />
          ) : (
            <EmptyProfileSection
              title="No services yet"
              description={
                isOwner
                  ? "Create a service listing when you are ready to offer bookings from your profile."
                  : "This profile has not listed any services."
              }
              actionHref={isOwner ? "/create?type=service" : undefined}
              actionLabel={isOwner ? "Create service" : undefined}
            />
          )
        )}

        {section === "events" && (
          <EventGrid
            events={events}
            emptyMessage={
              isOwner
                ? "You are not hosting any public events yet. Create one from the Create tab."
                : "This profile is not hosting any public events."
            }
          />
        )}

        {section === "about" && (
          <div className="space-y-4 md:space-y-6">
            {visibleFieldSet.has("bio") && (
              <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bio</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {profile.bio || "No bio yet."}
                </p>
              </section>
            )}

            {(visibleFieldSet.has("identity") || visibleFieldSet.has("availability")) && (
              <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Details</h2>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {visibleFieldSet.has("identity") && (
                    <>
                      <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Gender</p>
                        <p className="text-sm font-medium">{profile.gender || "Unspecified"}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Orientation</p>
                        <p className="text-sm font-medium">{profile.orientation || "Unspecified"}</p>
                      </div>
                    </>
                  )}
                  {visibleFieldSet.has("availability") && (
                    <>
                      <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Chat</p>
                        <p className="text-sm font-medium">
                          {profile.openToChat ? "Open to chat" : "Not open to chat"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Meet</p>
                        <p className="text-sm font-medium">
                          {profile.openToMeet ? "Open to meet" : "Not open to meet"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {tiers.length > 0 || isOwner ? (
              <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Memberships</h2>
                <div className="mt-3">
                  <TierMenu providerId={profile.id} tiers={tiers} isOwner={isOwner} />
                </div>
              </section>
            ) : null}

            {profile.serviceCategories.length > 0 && (
              <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Service interests</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.serviceCategories.map((category) => (
                    <Badge key={category} variant="outline">
                      {category}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            <PreferencesSummary desires={desires} isOwner={isOwner} />
          </div>
        )}

        {section === "reviews" && (
          canShowReviews ? (
            <ReviewsSection summary={reviewSummary!} reviews={reviews!} />
          ) : (
            <EmptyProfileSection
              title="No reviews yet"
              description="Reviews will appear here after completed bookings, RSVPs, or eligible interactions."
            />
          )
        )}
      </div>

      {isOwner && (
        <aside className="hidden space-y-4 lg:block">
          <div className="sticky top-24 space-y-4">
            <ProfileViewersPanel isPremium={isPremium} />
          </div>
        </aside>
      )}
    </div>
  );
}
