import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getPendingVerificationRequests } from "@/lib/verification";
import { PageHeader } from "@/components/layout/page-header";
import { VerificationQueue } from "@/components/admin/verification-queue";

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
      <VerificationQueue initialRequests={requests} />
    </div>
  );
}
