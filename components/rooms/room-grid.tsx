import { RoomCard } from "@/components/rooms/room-card";
import type { RoomCardData } from "@/lib/rooms";

export function RoomGrid({
  rooms,
  emptyMessage,
}: {
  rooms: RoomCardData[];
  emptyMessage: string;
}) {
  if (rooms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 2xl:grid-cols-3">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  );
}
