import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { RoomForm } from "@/components/rooms/room-form";

export default async function NewRoomPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <RoomForm />
    </div>
  );
}
