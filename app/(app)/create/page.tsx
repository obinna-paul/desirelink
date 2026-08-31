import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { FeedComposer } from "@/components/posts/feed-composer";

export default async function CreatePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true, profileType: true },
  });
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <FeedComposer displayName={profile.displayName} isProvider={isProviderProfileType(profile.profileType)} />
    </div>
  );
}
