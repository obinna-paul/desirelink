import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getMonetizedProviders, getPendingMonetizationApplications } from "@/lib/monetization";
import { PageHeader } from "@/components/layout/page-header";
import { MonetizationList } from "@/components/admin/monetization-list";
import { MonetizationApplicationQueue } from "@/components/admin/monetization-application-queue";

export default async function AdminMonetizationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!(await isAdminUser(session.user.id))) {
    notFound();
  }

  const [applications, providers] = await Promise.all([
    getPendingMonetizationApplications(),
    getMonetizedProviders(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Monetization"
        description="Review applications, and manage providers already earning from the rewards pool."
      />
      <div>
        <h2 className="mb-3 text-sm font-semibold">Pending applications</h2>
        <MonetizationApplicationQueue initialApplications={applications} />
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold">Monetized &amp; suspended providers</h2>
        <MonetizationList initialProviders={providers} />
      </div>
    </div>
  );
}
