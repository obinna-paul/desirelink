import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentProvider } from "@/lib/payments";
import { processPaymentEvent } from "@/lib/payments/webhook-handler";
import { creditProviderWallet } from "@/lib/wallet";
import { getHeartPackage, HEART_UNIT_PRICE_CENTS } from "@/lib/hearts-shared";
import { isProviderProfileType } from "@/lib/provider-types";
import { safeConfirmPayment } from "@/lib/payments/safe-call";
import { hasIdentityOnFile } from "@/lib/verification";

export type GiftContext = "live_stream" | "profile" | "chat";

const MAX_HEARTS_PER_GIFT = 10_000;

export type SendHeartsResult =
  | {
      ok: true;
      heartsBalance: number;
      hearts: number;
      giftId: string;
      sender: { username: string; displayName: string; avatarUrl: string };
    }
  | { ok: false; status: number; error: string };

/**
 * Moves hearts from sender to receiver and credits the receiver's wallet
 * with their share of the gift's value — the platform's cut is taken here,
 * upfront (see PLATFORM_FEE_RATE in lib/wallet.ts). Shared by every place a
 * gift can be sent: during a live stream (lib/live-streams.ts), from a
 * provider's profile, or from a chat thread.
 */
export async function settleGift(params: {
  senderId: string;
  receiverId: string;
  hearts: number;
  context: GiftContext;
  streamId?: string | null;
}): Promise<SendHeartsResult> {
  const { senderId, receiverId, hearts, context, streamId = null } = params;

  if (!Number.isInteger(hearts) || hearts <= 0 || hearts > MAX_HEARTS_PER_GIFT) {
    return { ok: false, status: 400, error: "Invalid gift amount." };
  }
  if (senderId === receiverId) {
    return { ok: false, status: 400, error: "You can't send yourself a gift." };
  }
  if (!(await hasIdentityOnFile(receiverId))) {
    return { ok: false, status: 400, error: "This creator hasn't activated gifts yet." };
  }

  const sender = await prisma.profile.findUnique({
    where: { id: senderId },
    select: { heartsBalance: true, username: true, displayName: true, avatarUrl: true },
  });
  if (!sender || sender.heartsBalance < hearts) {
    return { ok: false, status: 402, error: "Not enough hearts. Buy more to keep sending gifts." };
  }

  const valueCents = hearts * HEART_UNIT_PRICE_CENTS;

  const [updatedSender, gift] = await prisma.$transaction(async (tx) => {
    const updatedSender = await tx.profile.update({
      where: { id: senderId },
      data: { heartsBalance: { decrement: hearts } },
      select: { heartsBalance: true },
    });
    await creditProviderWallet(receiverId, valueCents, tx);
    const gift = await tx.gift.create({ data: { streamId, senderId, receiverId, hearts, valueCents, context } });
    return [updatedSender, gift] as const;
  });

  return {
    ok: true,
    heartsBalance: updatedSender.heartsBalance,
    hearts,
    giftId: gift.id,
    sender: { username: sender.username, displayName: sender.displayName, avatarUrl: sender.avatarUrl },
  };
}

/** Sends hearts directly to a provider outside a live stream — from their profile, or from a chat thread. */
export async function sendHeartsToProvider(
  senderId: string,
  receiverId: string,
  hearts: number,
  context: "profile" | "chat"
): Promise<SendHeartsResult> {
  const receiver = await prisma.profile.findUnique({ where: { id: receiverId }, select: { profileType: true } });
  if (!receiver || !isProviderProfileType(receiver.profileType)) {
    return { ok: false, status: 400, error: "Hearts can only be sent to creators." };
  }

  return settleGift({ senderId, receiverId, hearts, context });
}

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

/** Mirrors subscribeToProvider: charges a saved card directly, or starts checkout to collect one first. */
export async function purchaseHearts(
  profileId: string,
  packageId: string,
  urls: { successUrl: string; cancelUrl: string }
): Promise<HeartsPurchaseResult> {
  const pkg = getHeartPackage(packageId);
  if (!pkg) {
    return { ok: false, status: 400, error: "Unknown hearts package." };
  }

  try {
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
  } catch (error) {
    console.error("[payments] purchaseHearts failed", error);
    return { ok: false, status: 502, error: "We couldn't reach the payment provider. Please try again in a moment." };
  }
}

/**
 * Confirms a pending HeartPurchase after the buyer returns from checkout, by
 * verifying the transaction reference directly with the payment provider
 * (Paystack's recommended pattern). Safe to call more than once —
 * processPaymentEvent no-ops once the pending row is no longer "pending".
 */
export async function confirmHeartsPurchase(reference: string): Promise<void> {
  await safeConfirmPayment("confirmHeartsPurchase", async () => {
    const event = await paymentProvider.verifyTransaction(reference);
    await processPaymentEvent(event);
  });
}
