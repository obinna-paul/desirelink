import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarPlus,
  ImagePlus,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { getProviderServiceListings } from "@/lib/service-listings";
import { getMyVerificationRequests } from "@/lib/verification";
import { EventForm } from "@/components/events/event-form";
import { FeedComposer } from "@/components/posts/feed-composer";
import { ServiceListingManager } from "@/components/provider/ServiceListingManager";
import { RoomForm } from "@/components/rooms/room-form";
import { cn } from "@/lib/utils";

const CREATE_TYPES = ["post", "event", "service", "room"] as const;
type CreateType = (typeof CREATE_TYPES)[number];

const createOptions: {
  type: CreateType;
  label: string;
  eyebrow: string;
  description: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
  providerOnly?: boolean;
}[] = [
  {
    type: "post",
    label: "Post",
    eyebrow: "Default",
    description: "Share photos, videos, carousels, updates, and quick event-style moments.",
    href: "/create",
    icon: ImagePlus,
    primary: true,
  },
  {
    type: "event",
    label: "Event",
    eyebrow: "Gather",
    description: "Host something people can discover, save, and RSVP to.",
    href: "/create?type=event",
    icon: CalendarPlus,
    providerOnly: true,
  },
  {
    type: "service",
    label: "Service",
    eyebrow: "Earn",
    description: "List a paid service from your profile.",
    href: "/create?type=service",
    icon: BriefcaseBusiness,
    providerOnly: true,
  },
  {
    type: "room",
    label: "Room",
    eyebrow: "Discuss",
    description: "Start a community space around a topic.",
    href: "/create?type=room",
    icon: UsersRound,
  },
];

function isCreateType(value: string | undefined): value is CreateType {
  return CREATE_TYPES.some((type) => type === value);
}

function CreateOptionCard({
  option,
  activeType,
  layout = "mobile",
}: {
  option: (typeof createOptions)[number];
  activeType: CreateType;
  layout?: "desktop" | "mobile";
}) {
  const Icon = option.icon;
  const isActive = option.type === activeType;

  if (layout === "desktop" && !option.primary) {
    return (
      <Link
        href={option.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group flex min-h-[104px] items-center gap-4 rounded-2xl border p-4 transition-[background,border-color,box-shadow,transform] hover:-translate-y-0.5",
          isActive
            ? "border-foreground bg-foreground text-background shadow-lift"
            : "border-border/70 bg-card text-foreground shadow-sm hover:border-primary/35 hover:shadow-lift"
        )}
      >
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
            isActive
              ? "border-background/20 bg-background/10"
              : "border-border/70 bg-secondary text-primary"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-xl font-semibold tracking-tight">{option.label}</span>
          <span className={cn("mt-1 block text-sm leading-5", isActive ? "text-background/72" : "text-muted-foreground")}>
            {option.description}
          </span>
        </span>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5",
            isActive ? "bg-background/15" : "bg-secondary text-muted-foreground"
          )}
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={option.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex overflow-hidden rounded-[22px] border p-4 transition-[background,border-color,box-shadow,transform] hover:-translate-y-0.5 md:rounded-2xl",
        layout === "desktop" ? "min-h-[332px] p-6" : "min-h-[132px]",
        isActive
          ? option.primary
            ? "border-transparent bg-primary text-primary-foreground shadow-lift"
            : "border-foreground bg-foreground text-background shadow-lift"
          : "border-border/70 bg-card text-foreground shadow-sm hover:border-primary/35 hover:shadow-lift"
      )}
    >
      {option.primary && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl"
        />
      )}
      <span className="relative flex min-w-0 flex-1 flex-col justify-between gap-5">
        <span className="flex items-start justify-between gap-4">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
              isActive
                ? option.primary
                  ? "border-white/25 bg-white/15 text-white"
                  : "border-background/20 bg-background/10"
                : "border-border/70 bg-background text-primary"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]",
              isActive
                ? option.primary
                  ? "bg-white/15 text-white"
                  : "bg-background/10 text-background/80"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {option.eyebrow}
          </span>
        </span>

        <span className="block min-w-0">
          <span className={cn("block font-heading text-2xl font-semibold", layout === "desktop" ? "md:text-4xl" : "")}>
            {option.label}
          </span>
          <span
            className={cn(
              "mt-2 block max-w-md text-sm leading-6",
              layout === "desktop" && "text-base leading-7",
              isActive ? (option.primary ? "text-white/86" : "text-background/75") : "text-muted-foreground"
            )}
          >
            {option.description}
          </span>
        </span>
      </span>
      <span
        className={cn(
          "absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5",
          isActive ? "bg-background/15 text-current" : "bg-secondary text-muted-foreground"
        )}
      >
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}

export default async function CreatePage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      isVerifiedHost: true,
      isVerifiedServiceProvider: true,
      profileType: true,
    },
  });
  if (!profile) redirect("/login");
  const isProvider = isProviderProfileType(profile.profileType);

  const activeType = isCreateType(searchParams.type) ? searchParams.type : "post";
  if (!isProvider && (activeType === "event" || activeType === "service")) {
    redirect("/create");
  }
  const visibleCreateOptions = createOptions.filter((option) => !option.providerOnly || isProvider);
  const [serviceListings, verificationRequests] = await Promise.all([
    activeType === "service" ? getProviderServiceListings(profile.id) : Promise.resolve([]),
    activeType === "service" || activeType === "event" ? getMyVerificationRequests(profile.id) : Promise.resolve([]),
  ]);
  const latestServiceProviderRequest =
    verificationRequests.find((request) => request.requestType === "service_provider") ?? null;
  const latestHostRequest = verificationRequests.find((request) => request.requestType === "host") ?? null;

  const content =
    activeType === "event" ? (
      <EventForm isVerifiedHost={profile.isVerifiedHost} latestHostStatus={latestHostRequest?.status ?? null} />
    ) : activeType === "service" ? (
      <ServiceListingManager
        initialListings={serviceListings}
        startCreating
        isVerifiedServiceProvider={profile.isVerifiedServiceProvider}
        latestServiceProviderStatus={latestServiceProviderRequest?.status ?? null}
      />
    ) : activeType === "room" ? (
      <RoomForm />
    ) : (
      <FeedComposer displayName={profile.displayName} />
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 md:gap-6">
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Create
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with a post, or create an event, service, or room.
        </p>
      </div>

      <section className="hidden md:block">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Publishing studio
            </div>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-foreground">
              What are you creating today?
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Start with a feed post, or switch into an event, service, or room without leaving the flow.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <span className="font-semibold text-foreground">Post is primary.</span> The rest are creation paths.
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <CreateOptionCard option={visibleCreateOptions[0]} activeType={activeType} layout="desktop" />
          <div className="grid gap-3">
            {visibleCreateOptions.slice(1).map((option) => (
              <CreateOptionCard key={option.type} option={option} activeType={activeType} layout="desktop" />
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Creation type" className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:hidden">
        {visibleCreateOptions.map((option) => (
          <CreateOptionCard key={option.type} option={option} activeType={activeType} layout="mobile" />
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="hidden items-end justify-between md:flex">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {activeType === "post" ? "Compose" : "Create"}
            </p>
            <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">
              {createOptions.find((option) => option.type === activeType)?.label}
            </h2>
          </div>
          <p className="max-w-sm text-right text-sm leading-6 text-muted-foreground">
            {createOptions.find((option) => option.type === activeType)?.description}
          </p>
        </div>
        <div>{content}</div>
      </section>
    </div>
  );
}
