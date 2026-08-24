import { EventCard } from "@/components/events/event-card";
import type { UpcomingEvent } from "@/lib/events";

export function EventGrid({
  events,
  emptyMessage,
}: {
  events: UpcomingEvent[];
  emptyMessage: string;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
