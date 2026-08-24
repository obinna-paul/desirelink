import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Plus } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EventManageList } from "@/components/events/event-manage-list";
import { getHostEvents } from "@/lib/events";
import { getMyVerificationRequests } from "@/lib/verification";
import { VerificationRequestCard } from "@/components/verification/verification-request-card";

export default async function ManageEventsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, isVerifiedHost: true },
  });
  if (!profile) {
    redirect("/login");
  }

  const [events, requests] = await Promise.all([
    getHostEvents(profile.id),
    getMyVerificationRequests(profile.id),
  ]);
  const latestHostRequest = requests.find((request) => request.requestType === "host") ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Manage events" description="Events you're hosting." />
      <Button asChild className="w-fit gap-1.5">
        <Link href="/events/new">
          <Plus className="h-4 w-4" aria-hidden="true" /> Host a new event
        </Link>
      </Button>
      <EventManageList initialEvents={events} />
      <VerificationRequestCard
        requestType="host"
        isVerified={profile.isVerifiedHost}
        latestStatus={latestHostRequest?.status ?? null}
        ineligibleMessage={events.length === 0 ? "Host at least one event before requesting host verification." : undefined}
      />
    </div>
  );
}
