import Link from "next/link";
import { PlusCircle } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RoomGrid } from "@/components/rooms/room-grid";
import { getPublicRooms } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const rooms = await getPublicRooms();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Communities"
          description="Join rooms built around shared interests."
        />
      </div>

      <div className="flex items-center justify-between gap-3 md:hidden">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Communities
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Rooms for shared plans and interests.</p>
        </div>
      </div>

      <div className="md:w-fit">
        <Button asChild className="w-full gap-1.5 md:w-auto">
          <Link href="/rooms/new">
            <PlusCircle className="h-4 w-4" aria-hidden="true" /> Create a room
          </Link>
        </Button>
      </div>

      <RoomGrid
        rooms={rooms}
        emptyMessage="No public rooms yet. Be the first to create one."
      />
    </div>
  );
}
