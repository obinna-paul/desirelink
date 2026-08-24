import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CalendarDays, Lock, MapPin, Pencil, Users, UserPlus } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileGrid } from "@/components/home/profile-grid";
import { EventGrid } from "@/components/events/event-grid";
import { RsvpButtons } from "@/components/events/rsvp-buttons";
import { formatCents } from "@/lib/creator";
import { getEventDetail, getSimilarEvents } from "@/lib/events";
import { getEventAttendees, getViewerRsvpStatus } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
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

  const [attendees, similarEvents] = await Promise.all([
    getEventAttendees(event.id, canSeeFullGuestList),
    getSimilarEvents(event, viewerProfile.id),
  ]);

  const location = [event.venueName, event.address, event.city].filter(Boolean).join(", ");
  const hostInitials = event.host.displayName.slice(0, 2).toUpperCase();
  const isFull = event.maxAttendees !== null && event.currentAttendees >= event.maxAttendees;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={event.title} description={event.eventType} />

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="flex h-56 w-full items-center justify-center overflow-hidden bg-secondary">
          {event.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <CalendarDays className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-col gap-4 p-5">
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
              {" – "}
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
            className="flex w-fit items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 transition-colors hover:border-neon-pink/60"
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

          <div className="border-t border-border/60 pt-4">
            {isHost ? (
              <Button asChild variant="outline" className="gap-1.5">
                <Link href={`/events/manage/${event.id}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Manage this event
                </Link>
              </Button>
            ) : (
              <RsvpButtons
                eventId={event.id}
                initialStatus={viewerRsvp}
                isPriced={event.priceCents > 0}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
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
          See who you follow is attending — coming soon.
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
    </div>
  );
}
