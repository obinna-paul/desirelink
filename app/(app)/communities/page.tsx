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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Communities"
        description="Join rooms built around shared interests."
      />

      <div>
        <Button asChild className="gap-1.5">
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
