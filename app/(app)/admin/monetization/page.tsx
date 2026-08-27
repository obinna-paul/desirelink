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
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Monetization"
          description="Review applications, and manage providers already earning from the rewards pool."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Monetization
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Applications and earning providers.</p>
      </div>
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm md:normal-case md:tracking-normal md:text-foreground">
          Pending applications
        </h2>
        <MonetizationApplicationQueue initialApplications={applications} />
      </div>
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:text-sm md:normal-case md:tracking-normal md:text-foreground">
          Monetized &amp; suspended providers
        </h2>
        <MonetizationList initialProviders={providers} />
      </div>
    </div>
  );
}
