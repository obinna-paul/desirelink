import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { RoomForm } from "@/components/rooms/room-form";

export default async function NewRoomPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Create a room" description="Start a community around something you're into." />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Create a room
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Start a focused community space.</p>
      </div>
      <RoomForm />
    </div>
  );
}
