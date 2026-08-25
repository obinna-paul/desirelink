import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csvValue(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(_req: Request, { params }: { params: { providerId: string; earningId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true },
  });
  if (!profile || profile.id !== params.providerId) {
    return NextResponse.json({ error: "You can only download your own payout receipts" }, { status: 403 });
  }

  const earning = await prisma.providerEarning.findFirst({
    where: { id: params.earningId, providerId: params.providerId },
    select: { month: true, points: true, amountCents: true, status: true, payoutReference: true, paidAt: true },
  });
  if (!earning) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  const csv = [
    ["provider", "month", "amount_cents", "points", "status", "payout_reference", "paid_at"].map(csvValue).join(","),
    [
      profile.displayName,
      earning.month,
      earning.amountCents,
      earning.points,
      earning.status,
      earning.payoutReference,
      earning.paidAt?.toISOString() ?? "",
    ].map(csvValue).join(","),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="udala-payout-${earning.month}.csv"`,
    },
  });
}

