import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getModerationQueue } from "@/lib/moderation";
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
      <ModerationQueue initialItems={items} />
    </div>
  );
}
