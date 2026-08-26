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
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground md:rounded-xl md:p-10">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 2xl:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
