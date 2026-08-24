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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Host an event"
        description="Anyone can host — fill in the details below to publish your event."
      />
      <EventForm />
    </div>
  );
}
