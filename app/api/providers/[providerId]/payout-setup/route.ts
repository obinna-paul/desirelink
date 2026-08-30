import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { paymentProvider } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { MINIMUM_WITHDRAWAL_CENTS } from "@/lib/wallet";
import { isProviderProfileType } from "@/lib/provider-types";

async function getAuthorizedProvider(providerId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      profileType: true,
      payoutRecipientCode: true,
      payoutSetupStatus: true,
      payoutBankName: true,
      payoutAccountLast4: true,
      payoutAccountName: true,
      payoutCountry: true,
      payoutCurrency: true,
      payoutSetupUpdatedAt: true,
    },
  });

  if (!profile || profile.id !== providerId) {
    return { error: NextResponse.json({ error: "You can only manage your own payouts" }, { status: 403 }) };
  }
  if (!isProviderProfileType(profile.profileType)) {
    return { error: NextResponse.json({ error: "Payouts are only available to providers" }, { status: 403 }) };
  }

  return { profile };
}

export async function GET(_req: Request, { params }: { params: { providerId: string } }) {
  const auth = await getAuthorizedProvider(params.providerId);
  if ("error" in auth) return auth.error;

  let profile = auth.profile;
  if (profile.payoutRecipientCode) {
    const recipient = await paymentProvider.getPayoutRecipient(profile.payoutRecipientCode).catch(() => null);
    if (recipient) {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: {
          payoutSetupStatus: recipient.status,
          payoutBankName: recipient.bankName,
          payoutAccountLast4: recipient.accountLast4,
          payoutAccountName: recipient.accountName,
          payoutCountry: recipient.country,
          payoutCurrency: recipient.currency,
          payoutSetupUpdatedAt: new Date(),
        },
        select: {
          id: true,
          displayName: true,
          profileType: true,
          payoutRecipientCode: true,
          payoutSetupStatus: true,
          payoutBankName: true,
          payoutAccountLast4: true,
          payoutAccountName: true,
          payoutCountry: true,
          payoutCurrency: true,
          payoutSetupUpdatedAt: true,
        },
      });
    }
  }

  const walletProfile = await prisma.profile.findUniqueOrThrow({
    where: { id: params.providerId },
    select: { walletBalanceCents: true },
  });

  return NextResponse.json({
    payout: {
      status: profile.payoutSetupStatus,
      provider: "paystack",
      bankName: profile.payoutBankName,
      accountLast4: profile.payoutAccountLast4,
      accountName: profile.payoutAccountName,
      country: profile.payoutCountry,
      currency: profile.payoutCurrency,
      updatedAt: profile.payoutSetupUpdatedAt?.toISOString() ?? null,
      balanceCents: walletProfile.walletBalanceCents,
      minimumPayoutCents: MINIMUM_WITHDRAWAL_CENTS,
    },
  });
}

export async function POST(req: Request, { params }: { params: { providerId: string } }) {
  const auth = await getAuthorizedProvider(params.providerId);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : auth.profile.displayName;
  const accountNumber = typeof body?.accountNumber === "string" ? body.accountNumber.trim() : "";
  const bankCode = typeof body?.bankCode === "string" ? body.bankCode.trim() : "";
  const bankName = typeof body?.bankName === "string" ? body.bankName.trim() : "";
  const recipientType =
    typeof body?.recipientType === "string" && body.recipientType.trim() ? body.recipientType.trim() : "nuban";
  const country = typeof body?.country === "string" ? body.country.trim().toUpperCase() : "";
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : "USD";

  if (!accountNumber || !bankCode || !bankName) {
    return NextResponse.json({ error: "accountNumber, bankCode, and bankName are required" }, { status: 400 });
  }

  const recipient = await paymentProvider.createPayoutRecipient({
    name,
    recipientType,
    accountNumber,
    bankCode,
    bankName,
    country,
    currency,
  });

  const profile = await prisma.profile.update({
    where: { id: auth.profile.id },
    data: {
      payoutProvider: "paystack",
      payoutRecipientCode: recipient.recipientCode,
      payoutSetupStatus: recipient.status,
      payoutBankName: recipient.bankName,
      payoutAccountLast4: recipient.accountLast4,
      payoutAccountName: recipient.accountName,
      payoutCountry: recipient.country,
      payoutCurrency: recipient.currency,
      payoutSetupUpdatedAt: new Date(),
    },
    select: {
      payoutSetupStatus: true,
      payoutBankName: true,
      payoutAccountLast4: true,
      payoutAccountName: true,
      payoutCountry: true,
      payoutCurrency: true,
      payoutSetupUpdatedAt: true,
    },
  });

  return NextResponse.json({ payout: profile }, { status: 201 });
}
