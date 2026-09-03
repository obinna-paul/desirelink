import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";
import { recordAdminAction } from "@/lib/admin/audit";

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
      status: "pending";
      amountCents: number;
      feeCents: number;
      netAmountCents: number;
    }
  | { ok: false; status: number; error: string };

/**
 * Requests a withdrawal of a provider's full wallet balance — the wallet
 * unifies every earning source (gift hearts, tier subscriptions, and the
 * monthly rewards pool; see creditProviderWallet's callers), so there's
 * exactly one withdrawal flow and one fee, applied here rather than
 * per-earning. The balance is debited immediately (so it can't be withdrawn
 * twice), but the actual bank transfer does NOT happen here — an admin reviews the
 * request, manually sends the money from the business's own bank account, and then
 * confirms it via markWithdrawalPaid, typically within 2-3 business days.
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

  await prisma.$transaction([
    prisma.profile.update({
      where: { id: providerId },
      data: { walletBalanceCents: { decrement: amountCents } },
    }),
    prisma.walletWithdrawal.create({
      data: {
        providerId,
        amountCents,
        feeCents,
        netAmountCents,
        status: "pending",
      },
    }),
  ]);

  return {
    ok: true,
    status: "pending",
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

const withdrawalPayoutSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  payoutBankName: true,
  payoutAccountNumber: true,
  payoutAccountName: true,
} as const;

/** Every withdrawal request still awaiting admin review, oldest first - including the
 * provider's bank details, since payouts are sent manually from the business's own
 * account (see markWithdrawalPaid) rather than through an automated transfer. */
export async function getPendingWithdrawals() {
  return prisma.walletWithdrawal.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: {
      provider: { select: withdrawalPayoutSelect },
    },
  });
}

export type WithdrawalActionResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Records that an admin has manually sent the money for this withdrawal from the
 * business's own bank account. Paystack collects payments into that account but isn't
 * used to send payouts back out - there is no automated transfer here to succeed or fail,
 * this simply confirms a transfer that already happened outside the app.
 */
export async function markWithdrawalPaid(withdrawalId: string, actorId: string): Promise<WithdrawalActionResult> {
  const withdrawal = await prisma.walletWithdrawal.findUnique({
    where: { id: withdrawalId },
    include: { provider: { select: { userId: true, displayName: true } } },
  });
  if (!withdrawal) {
    return { ok: false, status: 404, error: "Withdrawal request not found." };
  }
  if (withdrawal.status !== "pending") {
    return { ok: false, status: 400, error: "This request has already been resolved." };
  }
  if (withdrawal.provider.userId === actorId) {
    return { ok: false, status: 403, error: "You can't mark your own withdrawal as paid." };
  }

  await prisma.walletWithdrawal.update({
    where: { id: withdrawal.id },
    data: { status: "paid", paidAt: new Date() },
  });

  await recordAdminAction({
    actorId,
    action: "withdrawal.mark_paid",
    targetType: "wallet_withdrawal",
    targetId: withdrawal.id,
    summary: `Marked ${withdrawal.provider.displayName}'s withdrawal as paid (sent manually)`,
    metadata: { netAmountCents: withdrawal.netAmountCents },
  });

  return { ok: true };
}

/** The manual transfer couldn't be completed (e.g. stale/incorrect bank details) -
 * refunds the provider's wallet balance so they can fix their payout details and request
 * again, mirroring the old auto-transfer-failure refund behavior. */
export async function markWithdrawalFailed(
  withdrawalId: string,
  actorId: string,
  reason: string,
): Promise<WithdrawalActionResult> {
  const withdrawal = await prisma.walletWithdrawal.findUnique({
    where: { id: withdrawalId },
    include: { provider: { select: { userId: true, displayName: true } } },
  });
  if (!withdrawal) {
    return { ok: false, status: 404, error: "Withdrawal request not found." };
  }
  if (withdrawal.status !== "pending") {
    return { ok: false, status: 400, error: "This request has already been resolved." };
  }
  if (withdrawal.provider.userId === actorId) {
    return { ok: false, status: 403, error: "You can't fail your own withdrawal." };
  }

  await prisma.$transaction([
    prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "failed" },
    }),
    prisma.profile.update({
      where: { id: withdrawal.providerId },
      data: { walletBalanceCents: { increment: withdrawal.amountCents } },
    }),
  ]);

  await recordAdminAction({
    actorId,
    action: "withdrawal.mark_failed",
    targetType: "wallet_withdrawal",
    targetId: withdrawal.id,
    summary: reason
      ? `Marked ${withdrawal.provider.displayName}'s withdrawal as failed: ${reason} (wallet refunded)`
      : `Marked ${withdrawal.provider.displayName}'s withdrawal as failed (wallet refunded)`,
    metadata: { amountCents: withdrawal.amountCents, reason },
  });

  return { ok: true };
}
