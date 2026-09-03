import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { markWithdrawalPaid, markWithdrawalFailed } from "@/lib/wallet";
import { readJson } from "@/lib/security/request";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const gate = await requireCapability(session?.user?.id, "manage_payouts");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await readJson(req)) as { action?: unknown; reason?: unknown } | null;
  const action = body?.action;
  if (action !== "paid" && action !== "failed") {
    return NextResponse.json({ error: "action must be 'paid' or 'failed'" }, { status: 400 });
  }

  const result =
    action === "paid"
      ? await markWithdrawalPaid(params.id, session!.user.id)
      : await markWithdrawalFailed(params.id, session!.user.id, typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "");

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
