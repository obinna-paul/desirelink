import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { adminReleaseEscrow } from "@/lib/admin/finance";

export async function POST(_req: Request, { params }: { params: { bookingId: string } }) {
  const session = await getServerSession(authOptions);
  const gate = await requireCapability(session?.user?.id, "manage_payouts");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const result = await adminReleaseEscrow(params.bookingId, session!.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
