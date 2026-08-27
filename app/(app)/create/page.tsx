import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CalendarPlus, PlusCircle } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Create"
          description="Share a post, start an event, or open a room."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Create
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Post, host, or start a room.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3">
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/events/new">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Event
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/rooms/new">
            <PlusCircle className="h-4 w-4" aria-hidden="true" /> Room
          </Link>
        </Button>
      </div>

      {isProviderProfileType(profile.profileType) ? (
        <FeedComposer displayName={profile.displayName} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
          Feed publishing is available to Creators, Pairs, and Service Providers.
        </div>
      )}
    </div>
  );
}
