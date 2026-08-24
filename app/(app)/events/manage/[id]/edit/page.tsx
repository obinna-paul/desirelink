import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { EventForm } from "@/components/events/event-form";
import { getEventForEdit } from "@/lib/events";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    redirect("/login");
  }

  const event = await getEventForEdit(params.id, profile.id);
  if (!event) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit event" description={event.title} />
      <EventForm event={event} eventId={event.id} />
    </div>
  );
}
