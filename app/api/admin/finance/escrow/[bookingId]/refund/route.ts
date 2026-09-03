import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { adminRefundEscrow } from "@/lib/admin/finance";
import { readJson } from "@/lib/security/request";

export async function POST(req: Request, { params }: { params: { bookingId: string } }) {
  const session = await getServerSession(authOptions);
  const gate = await requireCapability(session?.user?.id, "manage_payouts");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await readJson(req)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  const result = await adminRefundEscrow(params.bookingId, session!.user.id, reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
