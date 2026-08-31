import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { isProviderProfileType } from "@/lib/provider-types";

/** Minimum wallet balance a provider can withdraw at once, in kobo. */
export const MINIMUM_WITHDRAWAL_CENTS = 1_500_000;

/**
 * Flat platform fee taken only at withdrawal time. Every earning — gift
 * hearts, tier subscriptions, and the monthly rewards pool — credits the
 * wallet at its full value; the provider sees and keeps 100% until they
 * choose to cash out, at which point this cut is taken from the withdrawal.
 */
export const WALLET_WITHDRAWAL_FEE_RATE = 0.1;

/**
 * Credits a provider's withdrawable wallet balance by the full amount of an
 * earning — never reduced upfront. Pass `db` when this needs to participate
 * in a caller's transaction (e.g. alongside a payment-event idempotency
 * check) instead of running as its own standalone write.
 */
export async function creditProviderWallet(
  providerId: string,
  amountCents: number,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<void> {
  if (amountCents <= 0) return;
  await db.profile.update({
    where: { id: providerId },
    data: { walletBalanceCents: { increment: amountCents } },
  });
}

export type WithdrawWalletResult =
  | {
      ok: true;
      status: "success" | "pending";
      amountCents: number;
      feeCents: number;
      netAmountCents: number;
    }
  | { ok: false; status: number; error: string };

/**
 * Withdraws a provider's full wallet balance on demand — the wallet unifies
 * every earning source (gift hearts, tier subscriptions, and the monthly
 * rewards pool; see creditProviderWallet's callers), so there's exactly one
 * withdrawal flow and one fee, applied here rather than per-earning.
 */
export async function withdrawWalletBalance(
  providerId: string,
): Promise<WithdrawWalletResult> {
  const profile = await prisma.profile.findUnique({
    where: { id: providerId },
    select: {
      walletBalanceCents: true,
      payoutRecipientCode: true,
      payoutSetupStatus: true,
      displayName: true,
    },
  });
  if (!profile) {
    return { ok: false, status: 404, error: "Profile not found." };
  }
  if (
    !profile.payoutRecipientCode ||
    profile.payoutSetupStatus !== "verified"
  ) {
    return {
      ok: false,
      status: 400,
      error: "Set up your payout details before withdrawing.",
    };
  }
  if (profile.walletBalanceCents < MINIMUM_WITHDRAWAL_CENTS) {
    return {
      ok: false,
      status: 400,
      error: `Minimum withdrawal is ₦${(MINIMUM_WITHDRAWAL_CENTS / 100).toFixed(2)}.`,
    };
  }

  const amountCents = profile.walletBalanceCents;
  const feeCents = Math.round(amountCents * WALLET_WITHDRAWAL_FEE_RATE);
  const netAmountCents = amountCents - feeCents;

  const withdrawal = await prisma.walletWithdrawal.create({
    data: {
      providerId,
      amountCents,
      feeCents,
      netAmountCents,
      status: "pending",
    },
  });

  const transfer = await paymentProvider.createPayoutTransfer(
    profile.payoutRecipientCode,
    netAmountCents,
    `udala wallet withdrawal for ${profile.displayName}`,
    { providerId, withdrawalId: withdrawal.id },
  );

  if (transfer.status === "failed") {
    await prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "failed", payoutReference: transfer.reference },
    });
    return {
      ok: false,
      status: 502,
      error: "Withdrawal failed. Try again shortly.",
    };
  }

  await prisma.$transaction([
    prisma.profile.update({
      where: { id: providerId },
      data: { walletBalanceCents: { decrement: amountCents } },
    }),
    prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: transfer.status,
        payoutReference: transfer.reference,
        paidAt: transfer.status === "success" ? new Date() : null,
      },
    }),
  ]);

  return {
    ok: true,
    status: transfer.status,
    amountCents,
    feeCents,
    netAmountCents,
  };
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

  const [heartPurchases, giftsReceived, giftsSent, withdrawals] =
    await Promise.all([
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
              valueCents: true,
              context: true,
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
            select: {
              id: true,
              amountCents: true,
              feeCents: true,
              netAmountCents: true,
              status: true,
              createdAt: true,
              paidAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

  return {
    heartsBalance: profile.heartsBalance,
    walletBalanceCents: profile.walletBalanceCents,
    isProvider,
    payoutReady:
      profile.payoutSetupStatus === "verified" &&
      Boolean(profile.payoutRecipientCode),
    heartPurchases,
    giftsReceived,
    giftsSent,
    withdrawals,
  };
}
