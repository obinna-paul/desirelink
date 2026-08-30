import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { joinLiveStream } from "@/lib/live-streams";
import { LiveRoom } from "@/components/live/live-room";

export default async function LiveStreamPage({ params }: { params: { id: string } }) {
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

  return (
    <LiveRoom
      streamId={result.stream.id}
      token={result.token}
      livekitUrl={result.livekitUrl}
      isHost={result.isHost}
      title={result.stream.title}
      provider={result.stream.provider}
      viewerHeartsBalance={profile.heartsBalance}
    />
  );
}
