import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { processPaymentEvent } from "@/lib/payments/webhook-handler";
import { getHeartPackage } from "@/lib/hearts-shared";

async function getOrCreatePaymentCustomerId(profileId: string, existingCustomerId: string | null): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { user: { select: { email: true } } },
  });

  const customerId = await paymentProvider.createCustomer(profileId, profile.user.email);
  await prisma.profile.update({ where: { id: profileId }, data: { paymentCustomerId: customerId } });
  return customerId;
}

export type HeartsPurchaseResult =
  | { ok: true; state: "purchased"; hearts: number; balance: number }
  | { ok: true; state: "checkout"; checkoutUrl: string }
  | { ok: false; status: number; error: string };

/** Mirrors subscribeToPremium/subscribeToProvider: charges a saved card directly, or starts checkout to collect one first. */
export async function purchaseHearts(
  profileId: string,
  packageId: string,
  urls: { successUrl: string; cancelUrl: string }
): Promise<HeartsPurchaseResult> {
  const pkg = getHeartPackage(packageId);
  if (!pkg) {
    return { ok: false, status: 400, error: "Unknown hearts package." };
  }

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { paymentCustomerId: true },
  });
  const customerId = await getOrCreatePaymentCustomerId(profileId, profile.paymentCustomerId);
  const defaultCard = await prisma.paymentMethod.findFirst({ where: { userId: profileId, isDefault: true } });

  if (defaultCard) {
    const { reference, success } = await paymentProvider.chargeSavedPaymentMethod(
      customerId,
      defaultCard.externalId,
      pkg.priceCents,
      { kind: "hearts_purchase" }
    );
    if (!success) {
      return { ok: false, status: 402, error: "Your saved card was declined. Try updating your payment method." };
    }

    const [, updated] = await prisma.$transaction([
      prisma.heartPurchase.create({
        data: {
          userId: profileId,
          hearts: pkg.hearts,
          amountCents: pkg.priceCents,
          status: "succeeded",
          paymentReference: reference,
        },
      }),
      prisma.profile.update({
        where: { id: profileId },
        data: { heartsBalance: { increment: pkg.hearts } },
        select: { heartsBalance: true },
      }),
      prisma.transaction.create({
        data: { userId: profileId, amountCents: pkg.priceCents, status: "succeeded", provider: "card" },
      }),
    ]);

    return { ok: true, state: "purchased", hearts: pkg.hearts, balance: updated.heartsBalance };
  }

  const pending = await prisma.heartPurchase.create({
    data: { userId: profileId, hearts: pkg.hearts, amountCents: pkg.priceCents, status: "pending" },
  });

  const checkoutUrl = await paymentProvider.createCheckoutSession(
    customerId,
    pkg.priceCents,
    urls.successUrl,
    urls.cancelUrl,
    { kind: "hearts_purchase", pendingId: pending.id }
  );

  return { ok: true, state: "checkout", checkoutUrl };
}

/**
 * Confirms a pending HeartPurchase after the buyer returns from checkout, by
 * verifying the transaction reference directly with the payment provider
 * (Paystack's recommended pattern). Safe to call more than once —
 * processPaymentEvent no-ops once the pending row is no longer "pending".
 */
export async function confirmHeartsPurchase(reference: string): Promise<void> {
  const event = await paymentProvider.verifyTransaction(reference);
  await processPaymentEvent(event);
}
