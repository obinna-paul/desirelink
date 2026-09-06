import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveStreamPageState } from "@/lib/live-streams";
import { getPublicTiers } from "@/lib/tiers";
import { LiveRoom } from "@/components/live/live-room";
import { LiveScheduleCountdown } from "@/components/live/live-schedule-countdown";
import { LiveLockedNotice } from "@/components/live/live-locked-notice";
import { PRIVATE_ROBOTS, publicPageMetadata, seoDescription } from "@/lib/seo";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const stream = await prisma.liveStream.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      status: true,
      provider: { select: { displayName: true, avatarUrl: true } },
    },
  });

  if (!stream) return { title: "Live stream not found" };

  const title = stream.status === "scheduled"
    ? `${stream.title} - upcoming live with ${stream.provider.displayName}`
    : `${stream.title} - live with ${stream.provider.displayName}`;
  const description = seoDescription(
    null,
    stream.status === "scheduled"
      ? `${stream.provider.displayName} has scheduled ${stream.title} on Udala.`
      : `Watch ${stream.provider.displayName} live on Udala.`,
  );

  return {
    ...publicPageMetadata({
      title,
      description,
      path: `/live/${stream.id}`,
      image: stream.provider.avatarUrl,
    }),
    // Live rooms are short-lived, account-gated experiences. They still get
    // rich share previews, but should not become stale search results.
    robots: PRIVATE_ROBOTS,
  };
}

/**
 * Public by design (see middleware.ts's live/(?!go) carve-out) so a scheduled or live link
 * shared outside the app - Twitter, Instagram, wherever - actually renders for whoever
 * clicks it, logged in or not.
 */
export default async function LiveStreamPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { cam?: string; mic?: string };
}) {
  const session = await getServerSession(authOptions);
  const profile = session?.user?.id
    ? await prisma.profile.findUnique({
        where: { userId: session.user.id },
        select: { id: true, displayName: true, heartsBalance: true },
      })
    : null;

  const result = await getLiveStreamPageState(
    params.id,
    profile ? { id: profile.id, displayName: profile.displayName } : null,
  );

  if (result.state === "not_found") {
    notFound();
  }

  if (result.state === "ended") {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">
        This live has ended.
      </div>
    );
  }

  if (result.state === "scheduled") {
    return (
      <LiveScheduleCountdown
        streamId={result.streamId}
        title={result.title}
        scheduledFor={result.scheduledFor}
        provider={result.provider}
        isLoggedIn={Boolean(profile)}
      />
    );
  }

  if (result.state === "live_locked") {
    return <LiveLockedNotice streamId={result.streamId} title={result.title} provider={result.provider} />;
  }

  const tiers = result.isHost || !profile ? [] : await getPublicTiers(result.provider.id, profile.id);

  return (
    <LiveRoom
      streamId={result.streamId}
      token={result.token}
      livekitUrl={result.livekitUrl}
      isHost={result.isHost}
      title={result.title}
      startedAt={result.startedAt}
      initialHeartsTotal={result.totalHeartsReceived}
      provider={result.provider}
      viewerHeartsBalance={profile?.heartsBalance ?? 0}
      viewerProfileId={profile?.id ?? ""}
      heartGoal={result.heartGoal}
      requestOptions={result.requestOptions}
      initialCameraEnabled={searchParams.cam !== "0"}
      initialMicEnabled={searchParams.mic !== "0"}
      tiers={tiers}
    />
  );
}
