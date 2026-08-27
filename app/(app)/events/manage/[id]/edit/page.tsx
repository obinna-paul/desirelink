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
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Edit event" description={event.title} />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Edit event
        </h1>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{event.title}</p>
      </div>
      <EventForm event={event} eventId={event.id} />
    </div>
  );
}
