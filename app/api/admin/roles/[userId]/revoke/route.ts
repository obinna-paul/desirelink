import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { revokeAdmin } from "@/lib/admin/roles";

export async function POST(_req: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  const gate = await requireCapability(session?.user?.id, "manage_roles");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const result = await revokeAdmin(params.userId, session!.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
