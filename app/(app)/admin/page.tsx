import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getPendingVerificationRequests } from "@/lib/verification";
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
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/admin/moderation">Open moderation queue</Link>
        </Button>
      </div>
      <VerificationQueue initialRequests={requests} />
    </div>
  );
}
