import Link from "next/link";
import { Users2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RoomCardData } from "@/lib/rooms";

export function RoomCard({ room }: { room: RoomCardData }) {
  const hostInitials = room.createdBy.displayName.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/rooms/${room.id}`}
      className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-colors hover:border-neon-pink/60"
    >
      <div className="flex h-32 w-full items-center justify-center overflow-hidden bg-secondary">
        {room.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={room.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Users2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p className="truncate text-sm font-semibold">{room.name}</p>
        {room.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{room.description}</p>
        )}
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5 border border-border">
              <AvatarImage src={room.createdBy.avatarUrl} alt={room.createdBy.displayName} />
              <AvatarFallback className="text-[9px]">{hostInitials}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">{room.createdBy.displayName}</span>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users2 className="h-3 w-3" aria-hidden="true" />
            {room._count.members}
          </span>
        </div>
      </div>
    </Link>
  );
}
