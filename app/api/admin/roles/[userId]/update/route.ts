import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { setAdminRole } from "@/lib/admin/roles";
import { readJson } from "@/lib/security/request";

const VALID_ROLES = ["SUPPORT", "MODERATOR", "FINANCE", "SUPERADMIN"] as const;

export async function POST(req: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  const gate = await requireCapability(session?.user?.id, "manage_roles");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await readJson(req)) as { role?: unknown } | null;
  const role = typeof body?.role === "string" && (VALID_ROLES as readonly string[]).includes(body.role) ? (body.role as (typeof VALID_ROLES)[number]) : null;
  if (!role) {
    return NextResponse.json({ error: "A valid role is required." }, { status: 400 });
  }

  const result = await setAdminRole(params.userId, session!.user.id, role);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
