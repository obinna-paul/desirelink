import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EventForm } from "@/components/events/event-form";
import { ProviderUpgradePrompt } from "@/components/settings/provider-upgrade-prompt";
import { isProviderProfileType } from "@/lib/provider-types";
import { getMyVerificationRequests } from "@/lib/verification";

export default async function NewEventPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, isVerifiedHost: true, profileType: true },
  });
  if (!profile) {
    redirect("/login");
  }

  const requests = await getMyVerificationRequests(profile.id);
  const latestHostRequest = requests.find((request) => request.requestType === "host") ?? null;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {isProviderProfileType(profile.profileType) ? (
        <EventForm isVerifiedHost={profile.isVerifiedHost} latestHostStatus={latestHostRequest?.status ?? null} />
      ) : (
        <ProviderUpgradePrompt intent="event" />
      )}
    </div>
  );
}
