import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { DollarSign, Eye, Users } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { BecomeCreatorPrompt } from "@/components/creator/become-creator-prompt";
import { DashboardTabs } from "@/components/creator/dashboard-tabs";
import { StatCard } from "@/components/creator/stat-card";
import { AudienceList } from "@/components/creator/audience-list";
import { ContentList } from "@/components/creator/content-list";
import { TierManager } from "@/components/creator/tier-manager";
import { SubscriberGrowthChart, EarningsChart } from "@/components/creator/analytics-charts";
import {
  DEFAULT_CREATOR_DASHBOARD_TAB,
  formatCents,
  getCreatorStats,
  getCreatorTiers,
  getEarningsByMonth,
  getSubscriberGrowth,
  getSubscribers,
  isCreatorDashboardTab,
} from "@/lib/creator";
import { getCreatorProfilePosts } from "@/lib/posts";

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

  if (!profile.isCreator) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Creator dashboard"
          description="Subscribers, revenue, and analytics for your creator profile."
        />
        <BecomeCreatorPrompt />
      </div>
    );
  }

  const tab = isCreatorDashboardTab(searchParams.tab) ? searchParams.tab : DEFAULT_CREATOR_DASHBOARD_TAB;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Creator dashboard"
        description="Subscribers, revenue, and analytics for your creator profile."
      />
      <DashboardTabs activeTab={tab} />

      {tab === "overview" && <OverviewTab profileId={profile.id} />}
      {tab === "audience" && <AudienceTab profileId={profile.id} />}
      {tab === "content" && <ContentTab profileId={profile.id} />}
      {tab === "tiers" && <TiersTab profileId={profile.id} />}
      {tab === "analytics" && <AnalyticsTab profileId={profile.id} />}
    </div>
  );
}

async function OverviewTab({ profileId }: { profileId: string }) {
  const stats = await getCreatorStats(profileId);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Active subscribers" value={String(stats.subscriberCount)} icon={Users} />
      <StatCard label="Total revenue" value={formatCents(stats.totalRevenueCents)} icon={DollarSign} />
      <StatCard label="Profile views" value={stats.profileViews.toLocaleString()} icon={Eye} />
    </div>
  );
}

async function AudienceTab({ profileId }: { profileId: string }) {
  const subscribers = await getSubscribers(profileId);
  return <AudienceList subscribers={subscribers} />;
}

async function ContentTab({ profileId }: { profileId: string }) {
  const posts = await getCreatorProfilePosts(profileId, profileId);
  return <ContentList initialPosts={posts} />;
}

async function TiersTab({ profileId }: { profileId: string }) {
  const tiers = await getCreatorTiers(profileId);
  return <TierManager initialTiers={tiers} />;
}

async function AnalyticsTab({ profileId }: { profileId: string }) {
  const [growth, earnings] = await Promise.all([
    getSubscriberGrowth(profileId),
    getEarningsByMonth(profileId),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SubscriberGrowthChart data={growth} />
      <EarningsChart data={earnings} />
    </div>
  );
}
