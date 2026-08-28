import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { BriefcaseBusiness, CalendarPlus, ImagePlus, UsersRound, type LucideIcon } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { getProviderServiceListings } from "@/lib/service-listings";
import { PageHeader } from "@/components/layout/page-header";
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
  description: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
}[] = [
  {
    type: "post",
    label: "Post",
    description: "Share photos, videos, carousels, updates, and event-style posts.",
    href: "/create",
    icon: ImagePlus,
    primary: true,
  },
  {
    type: "event",
    label: "Event",
    description: "Host something people can discover and RSVP to.",
    href: "/create?type=event",
    icon: CalendarPlus,
  },
  {
    type: "service",
    label: "Service",
    description: "List a paid service from your provider profile.",
    href: "/create?type=service",
    icon: BriefcaseBusiness,
  },
  {
    type: "room",
    label: "Room",
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
        "group flex min-h-24 items-start gap-3 rounded-2xl border p-4 transition-colors md:rounded-xl",
        option.primary ? "sm:col-span-2 lg:col-span-2" : "",
        isActive
          ? "border-foreground bg-foreground text-background shadow-sm"
          : "border-border/60 bg-card text-foreground hover:border-primary/40 hover:bg-accent/70"
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
          isActive
            ? "border-background/20 bg-background/10"
            : "border-border/60 bg-background text-primary"
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{option.label}</span>
        <span className={cn("mt-1 block text-xs leading-5", isActive ? "text-background/75" : "text-muted-foreground")}>
          {option.description}
        </span>
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
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Create"
          description="Publish content from one place. Posts are primary; events, services, and rooms are additional creation paths."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Create
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with a post, or create an event, service, or room.
        </p>
      </div>

      <section aria-label="Creation type" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {createOptions.map((option) => (
          <CreateOptionCard key={option.type} option={option} activeType={activeType} />
        ))}
      </section>

      <section className="flex flex-col gap-4">{content}</section>
    </div>
  );
}
