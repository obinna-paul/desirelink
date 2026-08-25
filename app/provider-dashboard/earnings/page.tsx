import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { BecomeCreatorPrompt } from "@/components/creator/become-creator-prompt";
import { ProviderEarningsDashboard } from "@/components/provider/provider-earnings-dashboard";
import { getProviderEarningsDashboard } from "@/lib/rewards/earnings";
import { isProviderProfileType } from "@/lib/provider-types";

export default async function ProviderEarningsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, profileType: true },
  });
  if (!profile) {
    redirect("/login");
  }

  if (!isProviderProfileType(profile.profileType)) {
    return (
      <AppShell>
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Provider earnings"
            description="Earnings are available for creators, pairs, and service providers."
          />
          <BecomeCreatorPrompt />
        </div>
      </AppShell>
    );
  }

  const earnings = await getProviderEarningsDashboard(profile.id);
  if (!earnings) {
    redirect("/creator-dashboard");
  }

  return (
    <AppShell>
      <ProviderEarningsDashboard data={earnings} providerId={profile.id} />
    </AppShell>
  );
}
