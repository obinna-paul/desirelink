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
  },
  {
    type: "service",
    label: "Service",
    eyebrow: "Earn",
    description: "List a paid service from your provider profile.",
    href: "/create?type=service",
    icon: BriefcaseBusiness,
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
}: {
  option: (typeof createOptions)[number];
  activeType: CreateType;
}) {
  const Icon = option.icon;
  const isActive = option.type === activeType;

  return (
    <Link
      href={option.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex min-h-[132px] overflow-hidden rounded-[22px] border p-4 transition-[background,border-color,box-shadow,transform] hover:-translate-y-0.5 md:rounded-2xl",
        option.primary ? "md:col-span-5 lg:col-span-6 xl:col-span-5" : "md:col-span-3 lg:col-span-2 xl:col-span-1",
        isActive
          ? option.primary
            ? "border-transparent bg-[linear-gradient(135deg,hsl(276_72%_45%),hsl(335_70%_48%),hsl(24_90%_56%))] text-white shadow-lift"
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
          <span className={cn("block font-heading text-2xl font-semibold", option.primary ? "md:text-3xl" : "")}>
            {option.label}
          </span>
          <span
            className={cn(
              "mt-2 block max-w-md text-sm leading-6",
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

function ProviderOnlyNotice({ action }: { action: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
      {action} is available to Creators, Pairs, and Service Providers. Update your profile type in settings to unlock it.
    </div>
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
    select: { id: true, displayName: true, profileType: true },
  });
  if (!profile) redirect("/login");

  const activeType = isCreateType(searchParams.type) ? searchParams.type : "post";
  const isProvider = isProviderProfileType(profile.profileType);
  const serviceListings =
    activeType === "service" && profile.profileType === "SERVICE_PROVIDER"
      ? await getProviderServiceListings(profile.id)
      : [];

  const content =
    activeType === "event" ? (
      <EventForm />
    ) : activeType === "service" ? (
      profile.profileType === "SERVICE_PROVIDER" ? (
        <ServiceListingManager initialListings={serviceListings} startCreating />
      ) : (
        <ProviderOnlyNotice action="Service creation" />
      )
    ) : activeType === "room" ? (
      <RoomForm />
    ) : isProvider ? (
      <FeedComposer displayName={profile.displayName} />
    ) : (
      <ProviderOnlyNotice action="Post creation" />
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

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-5 lg:grid-cols-12 xl:grid-cols-8">
          {createOptions.map((option) => (
            <CreateOptionCard key={option.type} option={option} activeType={activeType} />
          ))}
        </div>
      </section>

      <section aria-label="Creation type" className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:hidden">
        {createOptions.map((option) => (
          <CreateOptionCard key={option.type} option={option} activeType={activeType} />
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
