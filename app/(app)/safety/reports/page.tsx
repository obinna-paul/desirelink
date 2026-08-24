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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Report history"
        description="Reports you've submitted and their review status."
      />
      <ReportsList reports={reports} />
    </div>
  );
}
