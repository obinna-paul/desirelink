import Link from "next/link";
import nextDynamic from "next/dynamic";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CalendarDays, Lock, MapPin, Pencil, Users, UserPlus } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionTab } from "@/components/layout/section-tab";
import { ProfileGrid } from "@/components/home/profile-grid";
import { EventGrid } from "@/components/events/event-grid";
import { RsvpButtons } from "@/components/events/rsvp-buttons";
import { ReportDialog } from "@/components/safety/report-dialog";
import { formatCents } from "@/lib/creator";
import { getEventDetail, getSimilarEvents } from "@/lib/events";
import { getEventAttendees, getViewerRsvpStatus } from "@/lib/rsvp";
import { getGroupMessages, getMutedUserIds } from "@/lib/group-chat";

export const dynamic = "force-dynamic";

type EventSection = "details" | "chat";

const GroupChat = nextDynamic(() =>
  import("@/components/chat/group-chat").then((mod) => mod.GroupChat)
);

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { section?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!viewerProfile) {
    redirect("/login");
  }

  const event = await getEventDetail(params.id, viewerProfile.id);
  if (!event) {
    notFound();
  }

  const isHost = event.hostId === viewerProfile.id;
  const viewerRsvp = isHost ? null : await getViewerRsvpStatus(event.id, viewerProfile.id);
  const canSeeFullGuestList = isHost || viewerRsvp === "going";
  const canAccessChat = canSeeFullGuestList;
  const section: EventSection = searchParams.section === "chat" ? "chat" : "details";

  const [attendees, similarEvents, chatMessages, mutedUserIds] = await Promise.all([
    getEventAttendees(event.id, canSeeFullGuestList),
    getSimilarEvents(event, viewerProfile.id),
    canAccessChat ? getGroupMessages("event", event.id) : Promise.resolve([]),
    canAccessChat ? getMutedUserIds("event", event.id) : Promise.resolve([]),
  ]);

  const location = [event.venueName, event.address, event.city].filter(Boolean).join(", ");
  const hostInitials = event.host.displayName.slice(0, 2).toUpperCase();
  const isFull = event.maxAttendees !== null && event.currentAttendees >= event.maxAttendees;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title={event.title} description={event.eventType} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:rounded-xl md:shadow-none">
        <div className="relative flex h-52 w-full items-center justify-center overflow-hidden bg-secondary md:h-56">
          {event.coverImageUrl ? (
            <Image
              src={event.coverImageUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 56rem, 100vw"
              className="object-cover"
            />
          ) : (
            <CalendarDays className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div className="md:hidden">
            <h1 className="font-heading text-2xl font-semibold leading-tight text-foreground">
              {event.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{event.eventType}</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{event.eventType}</Badge>
            {event.isPrivate && <Badge variant="secondary">Private</Badge>}
            {event.priceCents > 0 ? (
              <Badge variant="secondary">{formatCents(event.priceCents)}</Badge>
            ) : (
              <Badge variant="secondary">Free</Badge>
            )}
            {isFull && <Badge variant="outline">Full</Badge>}
          </div>

          <p className="whitespace-pre-line text-sm text-muted-foreground">{event.description}</p>

          <div className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
              {new Date(event.startTime).toLocaleString(undefined, {
                dateStyle: "full",
                timeStyle: "short",
              })}
              {" - "}
              {new Date(event.endTime).toLocaleString(undefined, { timeStyle: "short" })}
            </span>
            {location && (
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-neon-cyan" aria-hidden="true" /> {location}
              </span>
            )}
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
              {event.currentAttendees} going
              {event.maxAttendees ? ` (max ${event.maxAttendees})` : ""}
            </span>
          </div>

          <Link
            href={`/profile/${event.host.username}`}
            className="flex w-full items-center gap-2 rounded-2xl border border-border/60 bg-background px-3 py-2.5 transition-colors hover:border-neon-pink/60 md:w-fit md:rounded-lg md:py-2"
          >
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={event.host.avatarUrl} alt={event.host.displayName} />
              <AvatarFallback className="text-xs">{hostInitials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Hosted by</p>
              <p className="text-sm font-medium">{event.host.displayName}</p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4 [&>*]:w-full md:[&>*]:w-auto">
            {isHost ? (
              <Button asChild variant="outline" className="gap-1.5">
                <Link href={`/events/manage/${event.id}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Manage this event
                </Link>
              </Button>
            ) : (
              <>
                <RsvpButtons
                  eventId={event.id}
                  initialStatus={viewerRsvp}
                  isPriced={event.priceCents > 0}
                />
                <ReportDialog targetType="event" targetId={event.id} label="Report event" />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <SectionTab href={`/events/${event.id}`} label="Details" isActive={section === "details"} />
        <SectionTab href={`/events/${event.id}?section=chat`} label="Chat" isActive={section === "chat"} />
      </div>

      {section === "details" ? (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <h2 className="text-sm font-semibold">Who&apos;s going?</h2>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="neon">{attendees.counts.total} going</Badge>
              <Badge variant="outline">{attendees.counts.couples} couples</Badge>
              <Badge variant="outline">{attendees.counts.singles} singles</Badge>
              <Badge variant="outline">{attendees.counts.creators} creators</Badge>
              <Badge variant="outline">{attendees.counts.newMembers} new members</Badge>
            </div>

            <p className="flex items-center gap-1.5 text-xs italic text-muted-foreground">
              <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              See who you follow is attending - coming soon.
            </p>

            {attendees.hasHiddenAttendees && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                {canSeeFullGuestList
                  ? `Showing the first ${attendees.profiles.length} of ${attendees.counts.total} attendees.`
                  : "Some attendees are private. RSVP as Going to see the full guest list."}
              </p>
            )}

            <ProfileGrid
              profiles={attendees.profiles}
              emptyMessage="No one's RSVP'd going yet. Be the first!"
            />
          </div>

          {similarEvents.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Similar Events</h2>
              <EventGrid events={similarEvents} emptyMessage="" />
            </div>
          )}
        </>
      ) : canAccessChat ? (
        <GroupChat
          channelType="event"
          channelId={event.id}
          viewerProfileId={viewerProfile.id}
          initialMessages={chatMessages}
          canPost={canAccessChat}
          isAdmin={isHost}
          initiallyMuted={mutedUserIds.includes(viewerProfile.id)}
          moderationTargets={isHost ? attendees.profiles : []}
          initialMutedUserIds={mutedUserIds}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          <Lock className="h-6 w-6 text-neon-pink" aria-hidden="true" />
          <p className="font-medium text-foreground">Chat is for confirmed attendees</p>
          <p>RSVP as Going to join the conversation.</p>
        </div>
      )}
    </div>
  );
}
