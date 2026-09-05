import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getOpenSupportTickets } from "@/lib/support";
import { SupportTicketsQueue } from "@/components/admin/support-tickets-queue";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "manage_support_tickets");
  if (!gate.ok) {
    notFound();
  }

  const tickets = await getOpenSupportTickets();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">Messages sent through the help contact form.</p>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          Nothing open — inbox zero.
        </div>
      ) : (
        <SupportTicketsQueue tickets={tickets} />
      )}
    </div>
  );
}
