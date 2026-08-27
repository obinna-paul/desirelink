import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsList } from "@/components/safety/reports-list";
import { getMyReports } from "@/lib/report";

export const dynamic = "force-dynamic";

export default async function ReportHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!viewerProfile) {
    redirect("/login");
  }

  const reports = await getMyReports(viewerProfile.id);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader
          title="Report history"
          description="Reports you've submitted and their review status."
        />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Report history
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Track safety reports you have sent.</p>
      </div>
      <ReportsList reports={reports} />
    </div>
  );
}
