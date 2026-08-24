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
    <div className="flex flex-col gap-6">
      <PageHeader title="Create a room" description="Start a community around something you're into." />
      <RoomForm />
    </div>
  );
}
