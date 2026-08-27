import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getModerationQueue } from "@/lib/moderation";
import { PageHeader } from "@/components/layout/page-header";
import { ModerationQueue } from "@/components/admin/moderation-queue";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!(await isAdminUser(session.user.id))) {
    notFound();
  }

  const items = await getModerationQueue("pending");

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Moderation" description="Review keyword flags and member reports." />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Moderation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Review flags and member reports.</p>
      </div>
      <ModerationQueue initialItems={items} />
    </div>
  );
}
