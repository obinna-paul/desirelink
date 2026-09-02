import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminContext } from "@/lib/admin/access";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const context = await getAdminContext(session.user.id);
  if (!context.isAdmin) {
    notFound();
  }

  const admin = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  return (
    <AdminShell role={context.role} adminName={admin.name} adminEmail={admin.email}>
      {children}
    </AdminShell>
  );
}
