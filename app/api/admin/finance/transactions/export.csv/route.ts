import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireCapability } from "@/lib/admin/access";
import { getTransactionLedger } from "@/lib/admin/finance";
import { toCsv } from "@/lib/admin/csv";

export async function GET() {
  const session = await getServerSession(authOptions);
  const gate = await requireCapability(session?.user?.id, "manage_payouts");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const transactions = await getTransactionLedger(500);

  const csv = toCsv(
    ["Timestamp", "Username", "Amount (cents)", "Provider", "Status", "Escrow status"],
    transactions.map((t) => [
      t.createdAt.toISOString(),
      t.profile?.username ?? "",
      t.amountCents,
      t.provider,
      t.status,
      t.escrowStatus ?? "",
    ])
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
