jest.mock("@/lib/prisma", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    processedPaymentEvent: { create: jest.fn() },
    providerSubscription: { findUnique: jest.fn(), update: jest.fn() },
    transaction: { create: jest.fn() },
    profile: { update: jest.fn() },
    post: { findFirst: jest.fn() },
    postUnlock: { upsert: jest.fn() },
    notification: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((work: (tx: unknown) => Promise<unknown>) => work(prisma));
  return { prisma };
});

jest.mock("@/lib/email/billing-notifications", () => ({
  sendPaymentFailedEmail: jest.fn(),
  sendSubscriptionActivatedEmails: jest.fn(),
}));
jest.mock("@/lib/email/booking-notifications", () => ({ sendNewBookingRequestEmail: jest.fn() }));
jest.mock("@/lib/email/wallet-notifications", () => ({
  sendPayoutCompletedEmail: jest.fn(),
  sendPayoutFailedEmail: jest.fn(),
}));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { processPaymentEvent } from "@/lib/payments/webhook-handler";
import { sendSubscriptionActivatedEmails } from "@/lib/email/billing-notifications";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  processedPaymentEvent: { create: jest.Mock };
  providerSubscription: { findUnique: jest.Mock; update: jest.Mock };
  transaction: { create: jest.Mock };
  profile: { update: jest.Mock };
  post: { findFirst: jest.Mock };
  postUnlock: { upsert: jest.Mock };
  notification: { create: jest.Mock };
};
const mockSendSubscriptionActivatedEmails = sendSubscriptionActivatedEmails as jest.Mock;

const successfulSubscriptionEvent = {
  type: "charge.succeeded" as const,
  customerId: "CUS_fan",
  paymentMethod: null,
  amountCents: 1_000_000,
  currency: "NGN",
  environment: "live" as const,
  reference: "paystack-ref-1",
  metadata: {
    kind: "provider_tier",
    pendingId: "subscription-1",
    conversionPostId: "post-that-converted",
  },
};

describe("provider subscription settlement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PAYSTACK_CURRENCY = "NGN";
    delete process.env.USE_MOCK_PAYMENTS;
    mockPrisma.providerSubscription.findUnique.mockResolvedValue({
      id: "subscription-1",
      subscriberId: "fan-1",
      providerId: "creator-1",
      tierId: "tier-1",
      status: "pending",
      tier: { priceCents: 1_000_000 },
      subscriber: { paymentCustomerId: "CUS_fan", displayName: "Ada" },
    });
    mockPrisma.post.findFirst.mockResolvedValue({ id: "post-that-converted" });
  });

  it("activates one month, records payment, credits 85%, and unlocks the conversion post", async () => {
    await processPaymentEvent(successfulSubscriptionEvent);

    expect(mockPrisma.providerSubscription.update).toHaveBeenCalledWith({
      where: { id: "subscription-1" },
      data: expect.objectContaining({
        status: "active",
        paymentSubscriptionId: "paystack-ref-1",
        startsAt: expect.any(Date),
        endsAt: expect.any(Date),
      }),
    });
    const period = mockPrisma.providerSubscription.update.mock.calls[0][0].data;
    expect(period.endsAt.getTime()).toBeGreaterThan(period.startsAt.getTime());
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "fan-1",
        amountCents: 1_000_000,
        status: "succeeded",
        providerReference: "paystack-ref-1",
        providerSubscriptionId: "subscription-1",
        tierId: "tier-1",
      }),
    });
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: "creator-1" },
      data: { walletBalanceCents: { increment: 850_000 } },
    });
    expect(mockPrisma.post.findFirst).toHaveBeenCalledWith({
      where: { id: "post-that-converted", authorId: "creator-1" },
      select: { id: true },
    });
    expect(mockPrisma.postUnlock.upsert).toHaveBeenCalledWith({
      where: { postId_subscriberId: { postId: "post-that-converted", subscriberId: "fan-1" } },
      create: { postId: "post-that-converted", subscriberId: "fan-1" },
      update: {},
    });
    expect(mockSendSubscriptionActivatedEmails).toHaveBeenCalledWith(
      "fan-1",
      "creator-1",
      "tier-1",
      1_000_000,
      "paystack-ref-1",
      expect.any(Date),
    );
  });

  it("never unlocks a conversion post owned by another creator", async () => {
    mockPrisma.post.findFirst.mockResolvedValue(null);

    await processPaymentEvent({
      ...successfulSubscriptionEvent,
      reference: "paystack-ref-2",
      metadata: { ...successfulSubscriptionEvent.metadata, conversionPostId: "someone-elses-post" },
    });

    expect(mockPrisma.post.findFirst).toHaveBeenCalledWith({
      where: { id: "someone-elses-post", authorId: "creator-1" },
      select: { id: true },
    });
    expect(mockPrisma.postUnlock.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: "creator-1" },
      data: { walletBalanceCents: { increment: 850_000 } },
    });
  });
});
