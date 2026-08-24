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
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  );
}
