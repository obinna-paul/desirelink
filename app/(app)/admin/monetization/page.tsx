import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getMonetizedProviders } from "@/lib/monetization";
import { PageHeader } from "@/components/layout/page-header";
import { MonetizationList } from "@/components/admin/monetization-list";

export default async function AdminMonetizationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!(await isAdminUser(session.user.id))) {
    notFound();
  }

  const providers = await getMonetizedProviders();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Monetization"
        description="Providers earning from the rewards pool, and any suspended for policy violations."
      />
      <MonetizationList initialProviders={providers} />
    </div>
  );
}
