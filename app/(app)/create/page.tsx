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
    select: {
      id: true,
      displayName: true,
      profileType: true,
    },
  });

  if (!profile) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 md:gap-6">
      <section className="hidden rounded-2xl border border-border bg-card p-6 shadow-card md:block">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Create</p>
        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground">
              Make a post
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Share a photo, video, or carousel with the right frame before it reaches the feed.
            </p>
          </div>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            Gallery access opens through your browser picker, so permission stays controlled by the device.
          </p>
        </div>
      </section>

      <section className="md:hidden">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Create</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-foreground">
          New post
        </h1>
      </section>

      <FeedComposer
        displayName={profile.displayName}
        allowPremiumContent={isProviderProfileType(profile.profileType)}
      />
    </div>
  );
}
