import Link from "next/link";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getServerSession } from "next-auth";
import { ArrowLeft, DollarSign, Users } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { DashboardTabs } from "@/components/creator/dashboard-tabs";
import { StatCard } from "@/components/creator/stat-card";
import { AudienceList } from "@/components/creator/audience-list";
import { ApplicationsList } from "@/components/creator/applications-list";
import { CreatorAssistantPanel } from "@/components/creator/assistant-panel";
import { PricingManager } from "@/components/creator/pricing-manager";
import { WalletOverviewSection } from "@/components/wallet/wallet-overview-section";
import { ChartSkeleton } from "@/components/ui/skeleton";
import {
  CREATOR_DASHBOARD_TABS,
  DEFAULT_CREATOR_DASHBOARD_TAB,
  formatCents,
  getCreatorApplications,
  getCreatorAssistantInsights,
  getCreatorStats,
  getCreatorTiers,
  getEarningsByMonth,
  getSubscriberGrowth,
  getSubscribers,
  isCreatorDashboardTab,
} from "@/lib/creator";
import { getMyVerificationRequests } from "@/lib/verification";
import { VerificationRequestCard } from "@/components/verification/verification-request-card";

const SubscriberGrowthChart = dynamic(
  () =>
    import("@/components/creator/analytics-charts").then(
      (mod) => mod.SubscriberGrowthChart,
    ),
  { loading: () => <ChartSkeleton /> },
);

const EarningsChart = dynamic(
  () =>
    import("@/components/creator/analytics-charts").then(
      (mod) => mod.EarningsChart,
    ),
  { loading: () => <ChartSkeleton /> },
);

export default async function CreatorDashboardPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    redirect("/login");
  }
  if (!isProviderProfileType(profile.profileType)) {
    redirect("/");
  }

  const requestedTab = isCreatorDashboardTab(searchParams.tab)
    ? searchParams.tab
    : DEFAULT_CREATOR_DASHBOARD_TAB;
  const tab = CREATOR_DASHBOARD_TABS.some(
    (available) => available.value === requestedTab,
  )
    ? requestedTab
    : DEFAULT_CREATOR_DASHBOARD_TAB;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Link
        href="/profile/edit"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Profile settings
      </Link>

      <DashboardTabs activeTab={tab} tabs={CREATOR_DASHBOARD_TABS} />

      {tab === "wallet" && <WalletTab profileId={profile.id} />}
      {tab === "pricing" && <PricingTab profileId={profile.id} />}
      {tab === "assistant" && <AssistantTab profileId={profile.id} />}
      {tab === "audience" && <AudienceTab profileId={profile.id} />}
      {tab === "verification" && (
        <VerificationTab
          profileId={profile.id}
          isVerifiedProvider={
            profile.isVerified ||
            profile.isVerifiedCreator ||
            profile.isVerifiedServiceProvider
          }
        />
      )}
    </div>
  );
}

async function WalletTab({ profileId }: { profileId: string }) {
  const stats = await getCreatorStats(profileId);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
        <StatCard label="Active Fans" value={String(stats.subscriberCount)} icon={Users} />
        <StatCard
          label="Total revenue"
          value={formatCents(stats.totalRevenueCents)}
          icon={DollarSign}
          highlight
        />
      </div>
      <WalletOverviewSection profileId={profileId} />
    </div>
  );
}

async function PricingTab({ profileId }: { profileId: string }) {
  const tiers = await getCreatorTiers(profileId);
  return <PricingManager initialTiers={tiers} />;
}

async function AssistantTab({ profileId }: { profileId: string }) {
  const insights = await getCreatorAssistantInsights(profileId);
  return <CreatorAssistantPanel insights={insights} />;
}

async function AudienceTab({ profileId }: { profileId: string }) {
  const [subscribers, applications, growth, earnings] = await Promise.all([
    getSubscribers(profileId),
    getCreatorApplications(profileId),
    getSubscriberGrowth(profileId),
    getEarningsByMonth(profileId),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
        <SubscriberGrowthChart data={growth} />
        <EarningsChart data={earnings} />
      </div>
      <AudienceList subscribers={subscribers} />
      {applications.length > 0 && <ApplicationsList initialApplications={applications} />}
    </div>
  );
}

async function VerificationTab({
  profileId,
  isVerifiedProvider,
}: {
  profileId: string;
  isVerifiedProvider: boolean;
}) {
  const requests = await getMyVerificationRequests(profileId);
  const latest =
    requests.find((request) => request.requestType === "creator") ?? null;

  return (
    <VerificationRequestCard
      requestType="creator"
      isVerified={isVerifiedProvider}
      latestStatus={latest?.status ?? null}
    />
  );
}
