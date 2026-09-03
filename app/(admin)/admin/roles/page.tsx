import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { listAdmins } from "@/lib/admin/roles";
import { RolesManager } from "@/components/admin/roles-manager";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "manage_roles");
  if (!gate.ok) {
    notFound();
  }

  const admins = await listAdmins();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Admin roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">Who has console access, and what they can do with it.</p>
      </div>

      <RolesManager
        admins={admins.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          adminRole: a.adminRole,
          createdAt: a.createdAt.toISOString(),
        }))}
        currentUserId={session.user.id}
      />
    </div>
  );
}
