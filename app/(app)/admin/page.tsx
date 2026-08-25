import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getPendingVerificationRequests } from "@/lib/verification";
import { PageHeader } from "@/components/layout/page-header";
import { VerificationQueue } from "@/components/admin/verification-queue";
import { Button } from "@/components/ui/button";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!(await isAdminUser(session.user.id))) {
    notFound();
  }

  const requests = await getPendingVerificationRequests();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admin" description="Review pending creator and host verification requests." />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/admin/moderation">Open moderation queue</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/monetization">Manage monetization</Link>
        </Button>
      </div>
      <VerificationQueue initialRequests={requests} />
    </div>
  );
}
