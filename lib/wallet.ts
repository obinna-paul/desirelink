import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { MINIMUM_PAYOUT_CENTS } from "@/lib/payouts";
import { isProviderProfileType } from "@/lib/provider-types";

export type WithdrawWalletResult =
  | { ok: true; status: "success" | "pending"; amountCents: number }
  | { ok: false; status: number; error: string };

/**
 * Withdraws a provider's full gift-wallet balance (walletBalanceCents) on
 * demand, using the same payout recipient set up for the monthly rewards
 * payout (lib/payouts.ts) — gifts are a separate, running ledger, so this
 * moves independently of the monthly cron.
 */
export async function withdrawWalletBalance(providerId: string): Promise<WithdrawWalletResult> {
  const profile = await prisma.profile.findUnique({
    where: { id: providerId },
    select: { walletBalanceCents: true, payoutRecipientCode: true, payoutSetupStatus: true, displayName: true },
  });
  if (!profile) {
    return { ok: false, status: 404, error: "Profile not found." };
  }
  if (!profile.payoutRecipientCode || profile.payoutSetupStatus !== "verified") {
    return { ok: false, status: 400, error: "Set up your payout details before withdrawing." };
  }
  if (profile.walletBalanceCents < MINIMUM_PAYOUT_CENTS) {
    return {
      ok: false,
      status: 400,
      error: `Minimum withdrawal is $${(MINIMUM_PAYOUT_CENTS / 100).toFixed(2)}.`,
    };
  }

  const amountCents = profile.walletBalanceCents;
  const withdrawal = await prisma.walletWithdrawal.create({
    data: { providerId, amountCents, status: "pending" },
  });

  const transfer = await paymentProvider.createPayoutTransfer(
    profile.payoutRecipientCode,
    amountCents,
    `udala live gift withdrawal for ${profile.displayName}`,
    { providerId, withdrawalId: withdrawal.id }
  );

  if (transfer.status === "failed") {
    await prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "failed", payoutReference: transfer.reference },
    });
    return { ok: false, status: 502, error: "Withdrawal failed. Try again shortly." };
  }

  await prisma.$transaction([
    prisma.profile.update({ where: { id: providerId }, data: { walletBalanceCents: { decrement: amountCents } } }),
    prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: transfer.status,
        payoutReference: transfer.reference,
        paidAt: transfer.status === "success" ? new Date() : null,
      },
    }),
  ]);

  return { ok: true, status: transfer.status, amountCents };
}

export async function getWalletOverview(profileId: string) {
  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: {
      heartsBalance: true,
      walletBalanceCents: true,
      profileType: true,
      payoutRecipientCode: true,
      payoutSetupStatus: true,
    },
  });

  const isProvider = isProviderProfileType(profile.profileType);

  const [heartPurchases, giftsReceived, giftsSent, withdrawals] = await Promise.all([
    prisma.heartPurchase.findMany({
      where: { userId: profileId, status: "succeeded" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, hearts: true, amountCents: true, createdAt: true },
    }),
    isProvider
      ? prisma.gift.findMany({
          where: { receiverId: profileId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            hearts: true,
            providerShareCents: true,
            createdAt: true,
            sender: { select: { displayName: true, avatarUrl: true } },
          },
        })
      : Promise.resolve([]),
    prisma.gift.findMany({
      where: { senderId: profileId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        hearts: true,
        createdAt: true,
        receiver: { select: { displayName: true, avatarUrl: true } },
      },
    }),
    isProvider
      ? prisma.walletWithdrawal.findMany({
          where: { providerId: profileId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, amountCents: true, status: true, createdAt: true, paidAt: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    heartsBalance: profile.heartsBalance,
    walletBalanceCents: profile.walletBalanceCents,
    isProvider,
    payoutReady: profile.payoutSetupStatus === "verified" && Boolean(profile.payoutRecipientCode),
    heartPurchases,
    giftsReceived,
    giftsSent,
    withdrawals,
  };
}
