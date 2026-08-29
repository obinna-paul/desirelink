import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getServerSession } from "next-auth";
import { DollarSign, Eye, Users } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardTabs } from "@/components/creator/dashboard-tabs";
import { StatCard } from "@/components/creator/stat-card";
import { AudienceList } from "@/components/creator/audience-list";
import { ContentList } from "@/components/creator/content-list";
import { TierManager } from "@/components/creator/tier-manager";
import { ApplicationsList } from "@/components/creator/applications-list";
import { CreatorAssistantPanel } from "@/components/creator/assistant-panel";
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
import { getCreatorProfilePosts } from "@/lib/posts";
import { getMyVerificationRequests } from "@/lib/verification";
import { VerificationRequestCard } from "@/components/verification/verification-request-card";
import { ProviderEarningsDashboard } from "@/components/provider/provider-earnings-dashboard";
import { getProviderEarningsDashboard } from "@/lib/rewards/earnings";
import { MonetizationPanel } from "@/components/creator/monetization-panel";
import { getMonetizationEligibility } from "@/lib/monetization";

const SubscriberGrowthChart = dynamic(
  () => import("@/components/creator/analytics-charts").then((mod) => mod.SubscriberGrowthChart),
  { loading: () => <ChartSkeleton /> }
);

const EarningsChart = dynamic(
  () => import("@/components/creator/analytics-charts").then((mod) => mod.EarningsChart),
  { loading: () => <ChartSkeleton /> }
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

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) {
    redirect("/login");
  }

  const requestedTab = isCreatorDashboardTab(searchParams.tab) ? searchParams.tab : DEFAULT_CREATOR_DASHBOARD_TAB;
  const tab = CREATOR_DASHBOARD_TABS.some((available) => available.value === requestedTab) ? requestedTab : DEFAULT_CREATOR_DASHBOARD_TAB;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Creator Studio"
          description="Posts, fans, revenue, and insights from one place."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Fans, revenue, tiers, and insights.</p>
      </div>
      <DashboardTabs activeTab={tab} tabs={CREATOR_DASHBOARD_TABS} />

      {tab === "overview" && <OverviewTab profileId={profile.id} />}
      {tab === "assistant" && <AssistantTab profileId={profile.id} />}
      {tab === "audience" && <AudienceTab profileId={profile.id} />}
      {tab === "content" && <ContentTab profileId={profile.id} displayName={profile.displayName} />}
      {tab === "tiers" && <TiersTab profileId={profile.id} />}
      {tab === "applications" && <ApplicationsTab profileId={profile.id} />}
      {tab === "earnings" && <EarningsTab profileId={profile.id} />}
      {tab === "analytics" && <AnalyticsTab profileId={profile.id} />}
      {tab === "verification" && (
        <VerificationTab profileId={profile.id} isVerifiedCreator={profile.isVerifiedCreator} />
      )}
    </div>
  );
}

async function AssistantTab({ profileId }: { profileId: string }) {
  const insights = await getCreatorAssistantInsights(profileId);
  return <CreatorAssistantPanel insights={insights} />;
}

async function OverviewTab({ profileId }: { profileId: string }) {
  const stats = await getCreatorStats(profileId);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
      <StatCard label="Active Fans" value={String(stats.subscriberCount)} icon={Users} />
      <StatCard label="Total revenue" value={formatCents(stats.totalRevenueCents)} icon={DollarSign} />
      <StatCard label="Profile views" value={stats.profileViews.toLocaleString()} icon={Eye} />
    </div>
  );
}

async function AudienceTab({ profileId }: { profileId: string }) {
  const subscribers = await getSubscribers(profileId);
  return <AudienceList subscribers={subscribers} />;
}

async function ContentTab({ profileId, displayName }: { profileId: string; displayName: string }) {
  const posts = await getCreatorProfilePosts(profileId, profileId);
  return <ContentList initialPosts={posts} creatorDisplayName={displayName} />;
}

async function TiersTab({ profileId }: { profileId: string }) {
  const tiers = await getCreatorTiers(profileId);
  return <TierManager initialTiers={tiers} />;
}

async function ApplicationsTab({ profileId }: { profileId: string }) {
  const applications = await getCreatorApplications(profileId);
  return <ApplicationsList initialApplications={applications} />;
}

async function VerificationTab({
  profileId,
  isVerifiedCreator,
}: {
  profileId: string;
  isVerifiedCreator: boolean;
}) {
  const requests = await getMyVerificationRequests(profileId);
  const latest = requests.find((request) => request.requestType === "creator") ?? null;

  return (
    <VerificationRequestCard
      requestType="creator"
      isVerified={isVerifiedCreator}
      latestStatus={latest?.status ?? null}
    />
  );
}

async function EarningsTab({ profileId }: { profileId: string }) {
  const eligibility = await getMonetizationEligibility(profileId);
  if (!eligibility) return null;

  const earnings = await getProviderEarningsDashboard(profileId);
  if (!earnings) return null;

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <MonetizationPanel providerId={profileId} eligibility={eligibility} />
      <ProviderEarningsDashboard data={earnings} providerId={profileId} />
    </div>
  );
}

async function AnalyticsTab({ profileId }: { profileId: string }) {
  const [growth, earnings] = await Promise.all([
    getSubscriberGrowth(profileId),
    getEarningsByMonth(profileId),
  ]);

  return (
    <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
      <SubscriberGrowthChart data={growth} />
      <EarningsChart data={earnings} />
    </div>
  );
}
