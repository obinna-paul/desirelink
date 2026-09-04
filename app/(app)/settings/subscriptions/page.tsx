import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionsList } from "@/components/settings/subscriptions-list";
import { getMySubscriptions } from "@/lib/subscription-access";

export default async function SubscriptionsSettingsPage() {
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

  const subscriptions = await getMySubscriptions(profile.id);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <SubscriptionsList initialSubscriptions={subscriptions} />
    </div>
  );
}
