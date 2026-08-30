import Image from "next/image";
import Link from "next/link";
import type { Desire, Profile } from "@prisma/client";
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Camera,
  Heart,
  LayoutGrid,
  LineChart,
  Lock,
  MapPin,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import { PreferencesSummary } from "@/components/profile/preferences-summary";
import { EmptyProfileSection } from "@/components/profile/profile-view";
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

function CreatorSectionTab({ href, label, icon: Icon, isActive }: { href: string; label: string; icon: LucideIcon; isActive: boolean }) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex h-11 min-w-max items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors md:h-12 md:rounded-none md:border-b-2 md:px-3",
        isActive
          ? "bg-foreground text-background md:border-foreground md:bg-transparent md:text-foreground"
          : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground md:border-transparent md:bg-transparent"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

function VerificationDisclosure({ profile }: { profile: Profile }) {
  const badges = [
    profile.isVerified && "Identity verified",
    profile.isVerifiedCreator && "Content verified",
    profile.isVerifiedHost && "Host verified",
    profile.isVerifiedServiceProvider && "Service provider verified",
    profile.isTrustedMember && "Trusted member",
  ].filter(Boolean) as string[];

  if (badges.length === 0) return null;

  return (
    <span className="relative inline-block align-middle">
      <details className="group">
        <summary className="flex h-6 w-6 cursor-pointer list-none items-center justify-center text-primary [&::-webkit-details-marker]:hidden">
          <BadgeCheck className="h-5 w-5 fill-primary text-primary-foreground" aria-hidden="true" />
          <span className="sr-only">Show verification details</span>
        </summary>
        <div className="absolute left-0 top-full z-10 mt-2 w-64 rounded-xl border border-border/70 bg-card p-3 shadow-lg">
          <ul className="flex flex-col gap-1.5">
            {badges.map((label) => (
              <li key={label} className="flex items-center gap-2 text-xs font-medium text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> {label}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </span>
  );
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
    <div className="w-full min-w-0">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 md:gap-6">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm md:rounded-3xl">
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
            <div className="relative -mt-10 shrink-0 self-start sm:-mt-14 md:mt-0">
              <Avatar className="h-20 w-20 border-4 border-card bg-secondary shadow-md sm:h-24 sm:w-24 md:h-28 md:w-28">
                <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                <AvatarFallback className="text-lg md:text-2xl">{initials}</AvatarFallback>
              </Avatar>
              {isOwner && (
                <Link
                  href="/profile/edit"
                  aria-label="Edit profile photo"
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-foreground text-background hover:bg-foreground/90"
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
                <VerificationDisclosure profile={profile} />
                {isPremium && <PremiumBadge />}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
                {accountTypeLabel && (
                  <Badge variant="outline" className="whitespace-nowrap">
                    {accountTypeLabel}
                  </Badge>
                )}
              </div>

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

              <div className="mt-4 flex max-w-sm gap-2 rounded-2xl border border-border/60 bg-background/55 p-2 text-center">
                <div className="flex-1 rounded-xl bg-card px-2 py-2">
                  <p className="text-base font-semibold">{posts.length}</p>
                  <p className="text-xs text-muted-foreground">Posts</p>
                </div>
                <div className="flex-1 rounded-xl bg-card px-2 py-2">
                  <p className="text-base font-semibold">{stats.subscriberCount}</p>
                  <p className="text-xs text-muted-foreground">Subscribers</p>
                </div>
                <Link href={sectionHref(profileHref, "reviews")} className="flex-1 rounded-xl bg-card px-2 py-2 hover:bg-secondary">
                  <p className="text-base font-semibold">
                    {reviewSummary.totalCount > 0 ? reviewSummary.averageRating.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Rating</p>
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
              className="mt-4 flex items-center gap-3 rounded-2xl border border-border/60 bg-background/55 p-3.5 transition-colors hover:border-primary/40 sm:p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
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
            <details className="group mt-4 rounded-2xl border border-border/60 bg-background/45 px-4 py-1 open:pb-4">
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
                        <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Gender</p>
                          <p className="text-sm font-medium">{profile.gender || "Unspecified"}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Orientation</p>
                          <p className="text-sm font-medium">{profile.orientation || "Unspecified"}</p>
                        </div>
                      </>
                    )}
                    {visibleFieldSet.has("availability") && (
                      <>
                        <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
                          <p className="text-xs text-muted-foreground">Chat</p>
                          <p className="text-sm font-medium">
                            {profile.openToChat ? "Open to chat" : "Not open to chat"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
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
        className="-mx-3 flex min-w-0 gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:gap-6 md:border-b md:border-border/70 md:px-0 md:pb-0"
      >
        {CREATOR_SECTIONS.map((item) => (
          <CreatorSectionTab
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
          emptyActionHref={isOwner ? "/create?type=service" : undefined}
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
