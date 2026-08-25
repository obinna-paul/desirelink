import "server-only";

import { paymentProvider } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export const MINIMUM_PAYOUT_CENTS = 1000;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthKey(reference = new Date()) {
  return monthKey(new Date(reference.getFullYear(), reference.getMonth() - 1, 1));
}

export async function getProviderPayoutBalance(providerId: string, reference = new Date()) {
  const cutoffMonth = previousMonthKey(reference);
  const pending = await prisma.providerEarning.findMany({
    where: { providerId, status: "pending", month: { lte: cutoffMonth } },
    select: { amountCents: true },
  });
  return pending.reduce((sum, earning) => sum + earning.amountCents, 0);
}

export async function processProviderPayouts(reference = new Date()) {
  const cutoffMonth = previousMonthKey(reference);
  const pendingEarnings = await prisma.providerEarning.findMany({
    where: { status: "pending", month: { lte: cutoffMonth } },
    include: {
      provider: {
        select: {
          id: true,
          displayName: true,
          payoutRecipientCode: true,
          payoutSetupStatus: true,
          payoutCurrency: true,
        },
      },
    },
    orderBy: [{ providerId: "asc" }, { month: "asc" }],
  });

  const byProvider = new Map<string, typeof pendingEarnings>();
  for (const earning of pendingEarnings) {
    byProvider.set(earning.providerId, [...(byProvider.get(earning.providerId) ?? []), earning]);
  }

  const results = [];
  for (const [providerId, earnings] of Array.from(byProvider.entries())) {
    const provider = earnings[0]?.provider;
    const amountCents = earnings.reduce((sum, earning) => sum + earning.amountCents, 0);

    if (!provider?.payoutRecipientCode || provider.payoutSetupStatus !== "verified") {
      results.push({ providerId, status: "skipped", reason: "payout_not_verified", amountCents });
      continue;
    }

    if (amountCents < MINIMUM_PAYOUT_CENTS) {
      results.push({ providerId, status: "rolled_over", reason: "below_minimum_threshold", amountCents });
      continue;
    }

    const months = earnings.map((earning) => earning.month).join(", ");
    const transfer = await paymentProvider.createPayoutTransfer(
      provider.payoutRecipientCode,
      amountCents,
      `Udala provider payout for ${months}`,
      { providerId, months, cutoffMonth }
    );

    if (transfer.status === "failed") {
      results.push({ providerId, status: "failed", reference: transfer.reference, amountCents });
      continue;
    }

    await prisma.providerEarning.updateMany({
      where: { id: { in: earnings.map((earning) => earning.id) } },
      data: {
        status: transfer.status === "success" ? "paid" : "processing",
        payoutReference: transfer.reference,
        paidAt: transfer.status === "success" ? new Date() : null,
      },
    });

    console.warn(`[payouts] Provider ${provider.displayName} payout ${transfer.reference} created.`);
    results.push({ providerId, status: transfer.status, reference: transfer.reference, amountCents });
  }

  return { cutoffMonth, processedProviders: results.length, results };
}

