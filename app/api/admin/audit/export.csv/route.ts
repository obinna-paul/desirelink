import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getAuditLog, type AdminAuditAction } from "@/lib/admin/audit";
import { toCsv } from "@/lib/admin/csv";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const gate = await requireCapability(session?.user?.id, "view_audit_log");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? undefined;

  const { items } = await getAuditLog({ take: 200, action: action as AdminAuditAction | undefined });

  const csv = toCsv(
    ["Timestamp", "Action", "Actor", "Actor email", "Target type", "Target id", "Summary"],
    items.map((entry) => [
      entry.createdAt.toISOString(),
      entry.action,
      entry.actor.name,
      entry.actor.email,
      entry.targetType,
      entry.targetId ?? "",
      entry.summary,
    ])
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
