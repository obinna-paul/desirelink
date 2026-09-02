import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getModerationQueue } from "@/lib/moderation";
import { ModerationQueue } from "@/components/admin/moderation-queue";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "moderate_content");
  if (!gate.ok) {
    notFound();
  }

  const items = await getModerationQueue("pending");

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModerationQueue initialItems={items} />
    </div>
  );
}
