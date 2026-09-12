import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getSpecTestLeads, SPEC_TYPE_READINGS, type SpecTypeKey } from "@/lib/spec-test";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminSpecTestLeadsPage({ searchParams }: { searchParams?: { cursor?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await requireCapability(session.user.id, "view_leads");
  if (!gate.ok) {
    notFound();
  }

  const { items, nextCursor } = await getSpecTestLeads({ take: 50, cursor: searchParams?.cursor });

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Spec Test leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone who asked to receive a copy of their Spec Test result by email.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
          No leads yet.
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((lead) => (
              <li
                key={lead.id}
                className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm md:rounded-xl md:shadow-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{SPEC_TYPE_READINGS[lead.specType as SpecTypeKey]?.name ?? lead.specType}</Badge>
                  {lead.consentMarketing && <Badge>Marketing OK</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground" title={new Date(lead.createdAt).toISOString()}>
                    {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-foreground">{lead.email}</p>
              </li>
            ))}
          </ul>

          {nextCursor && (
            <Link
              href={`/admin/spec-test?cursor=${nextCursor}`}
              className="self-center text-sm font-medium text-primary hover:underline"
            >
              Load more
            </Link>
          )}
        </>
      )}
    </div>
  );
}
