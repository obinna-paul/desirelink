import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderEarningsDashboard } from "@/lib/rewards/earnings";

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values: Array<string | number>) {
  return values.map(csvCell).join(",");
}

export async function GET(_req: Request, { params }: { params: { providerId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (viewerProfile?.id !== params.providerId) {
    return NextResponse.json({ error: "You can only export your own earnings" }, { status: 403 });
  }

  const earnings = await getProviderEarningsDashboard(params.providerId);
  if (!earnings) {
    return NextResponse.json({ error: "Provider profile not found" }, { status: 404 });
  }

  const lines = [
    csvRow(["section", "month", "label", "amount_cents", "points", "status"]),
    ...earnings.monthly.map((month) =>
      csvRow(["monthly", month.month, month.label, month.totalCents, month.points, ""])
    ),
    ...earnings.sourceBreakdown.map((source) =>
      csvRow(["source", "", source.label, source.amountCents, "", source.status])
    ),
    ...earnings.payoutHistory.map((payout) =>
      csvRow(["payout", payout.month, payout.label, payout.amountCents, payout.points, payout.status])
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="udala-provider-earnings.csv"',
    },
  });
}
