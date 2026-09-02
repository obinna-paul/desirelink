import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { paymentProvider } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

/**
 * Resolves the account holder's name straight from the bank, so the payout
 * form never has to ask the provider to type their own name (which risks a
 * mismatch that fails the actual transfer later). Called as the provider
 * finishes typing their account number against a chosen bank.
 */
export async function POST(req: Request, { params }: { params: { providerId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile || profile.id !== params.providerId) {
    return NextResponse.json({ error: "You can only manage your own payouts" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const accountNumber = typeof body?.accountNumber === "string" ? body.accountNumber.trim() : "";
  const bankCode = typeof body?.bankCode === "string" ? body.bankCode.trim() : "";

  if (!/^\d{10}$/.test(accountNumber) || !bankCode) {
    return NextResponse.json({ error: "Enter a valid 10-digit account number and choose a bank." }, { status: 400 });
  }

  try {
    const accountName = await paymentProvider.resolveAccountName(accountNumber, bankCode);
    return NextResponse.json({ accountName });
  } catch (error) {
    console.error("[payout-setup/resolve] failed to resolve account", error);
    return NextResponse.json(
      { error: "Couldn't verify that account number. Double-check the bank and number." },
      { status: 400 },
    );
  }
}
