import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { EventForm } from "@/components/events/event-form";

export default async function NewEventPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Host an event"
          description="Anyone can host - fill in the details below to publish your event."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Host an event
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Add the details people need before they RSVP.</p>
      </div>
      <EventForm />
    </div>
  );
}
