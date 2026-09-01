import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { joinLiveStream } from "@/lib/live-streams";
import { getPublicTiers } from "@/lib/tiers";
import { LiveRoom } from "@/components/live/live-room";

export default async function LiveStreamPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { cam?: string; mic?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, heartsBalance: true },
  });
  if (!profile) {
    redirect("/login");
  }

  const result = await joinLiveStream(params.id, profile.id, profile.displayName);
  if (!result.ok) {
    redirect("/");
  }

  const tiers = result.isHost ? [] : await getPublicTiers(result.stream.provider.id, profile.id);

  return (
    <LiveRoom
      streamId={result.stream.id}
      token={result.token}
      livekitUrl={result.livekitUrl}
      isHost={result.isHost}
      title={result.stream.title}
      startedAt={result.stream.startedAt}
      initialHeartsTotal={result.stream.totalHeartsReceived}
      provider={result.stream.provider}
      viewerHeartsBalance={profile.heartsBalance}
      viewerProfileId={profile.id}
      heartGoal={result.stream.heartGoal}
      requestOptions={result.stream.requestOptions}
      initialCameraEnabled={searchParams.cam !== "0"}
      initialMicEnabled={searchParams.mic !== "0"}
      tiers={tiers}
    />
  );
}
