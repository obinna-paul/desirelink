jest.mock("@/lib/prisma", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    profile: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    gift: { create: jest.fn() },
    verificationRequest: { findFirst: jest.fn() },
  };
  prisma.$transaction = jest.fn((arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => Promise<unknown>)(prisma) : Promise.all(arg as Promise<unknown>[])
  );
  return { prisma };
});
jest.mock("@/lib/payments", () => ({ paymentProvider: {} }));
jest.mock("@/lib/payments/webhook-handler", () => ({ processPaymentEvent: jest.fn() }));

import { settleGift, sendHeartsToProvider } from "@/lib/hearts";
import { HEART_UNIT_PRICE_CENTS } from "@/lib/hearts-shared";
import { PLATFORM_FEE_RATE } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  profile: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  gift: { create: jest.Mock };
  verificationRequest: { findFirst: jest.Mock };
};

describe("settleGift", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The receiver is assumed to have identity on file unless a test says otherwise -
    // settleGift gates on hasIdentityOnFile before the sender/balance checks these tests exercise.
    mockPrisma.verificationRequest.findFirst.mockResolvedValue({ id: "req-1" });
  });

  it("rejects a non-positive or non-integer gift amount", async () => {
    const result = await settleGift({ senderId: "a", receiverId: "b", hearts: 0, context: "profile" });
    expect(result).toEqual({ ok: false, status: 400, error: "Invalid gift amount." });
    expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a gift to yourself", async () => {
    const result = await settleGift({ senderId: "a", receiverId: "a", hearts: 10, context: "profile" });
    expect(result).toEqual({ ok: false, status: 400, error: "You can't send yourself a gift." });
  });

  it("rejects a gift when the receiver hasn't activated verification", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ isVerified: false, isVerifiedCreator: false, isVerifiedServiceProvider: false });
    mockPrisma.verificationRequest.findFirst.mockResolvedValue(null);

    const result = await settleGift({ senderId: "a", receiverId: "b", hearts: 10, context: "chat" });

    expect(result).toEqual({ ok: false, status: 400, error: "This creator hasn't activated gifts yet." });
    expect(mockPrisma.profile.update).not.toHaveBeenCalled();
  });

  it("rejects when the sender doesn't have enough hearts", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ heartsBalance: 5, username: "u", displayName: "U", avatarUrl: "" });

    const result = await settleGift({ senderId: "a", receiverId: "b", hearts: 10, context: "profile" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(402);
  });

  it("credits the receiver's wallet with their 85% share of the gift's value — the platform's cut is taken upfront", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      heartsBalance: 100,
      username: "sender",
      displayName: "Sender",
      avatarUrl: "",
    });
    mockPrisma.profile.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.profile.findUniqueOrThrow.mockResolvedValue({ heartsBalance: 90 });
    mockPrisma.profile.update.mockResolvedValue({});
    mockPrisma.gift.create.mockResolvedValue({ id: "gift-1" });

    const result = await settleGift({ senderId: "a", receiverId: "b", hearts: 10, context: "profile" });
    const expectedValueCents = 10 * HEART_UNIT_PRICE_CENTS;
    const expectedNetCents = expectedValueCents - Math.round(expectedValueCents * PLATFORM_FEE_RATE);

    expect(result).toEqual({
      ok: true,
      heartsBalance: 90,
      hearts: 10,
      giftId: "gift-1",
      sender: { username: "sender", displayName: "Sender", avatarUrl: "" },
    });
    expect(mockPrisma.profile.updateMany).toHaveBeenCalledWith({
      where: { id: "a", heartsBalance: { gte: 10 } },
      data: { heartsBalance: { decrement: 10 } },
    });
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { walletBalanceCents: { increment: expectedNetCents } },
    });
    expect(mockPrisma.gift.create).toHaveBeenCalledWith({
      data: {
        streamId: null,
        senderId: "a",
        receiverId: "b",
        hearts: 10,
        valueCents: expectedValueCents,
        context: "profile",
      },
    });
  });

  it("does not create or credit a gift when an overlapping send has already spent the balance", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      heartsBalance: 10,
      username: "sender",
      displayName: "Sender",
      avatarUrl: "",
    });
    mockPrisma.profile.updateMany.mockResolvedValue({ count: 0 });

    const result = await settleGift({ senderId: "a", receiverId: "b", hearts: 10, context: "profile" });

    expect(result).toEqual({
      ok: false,
      status: 402,
      error: "Not enough hearts. Buy more to keep sending gifts.",
    });
    expect(mockPrisma.profile.update).not.toHaveBeenCalled();
    expect(mockPrisma.gift.create).not.toHaveBeenCalled();
  });
});

describe("sendHeartsToProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects sending hearts to a non-provider", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ profileType: "EXPLORER" });

    const result = await sendHeartsToProvider("a", "b", 10, "profile");

    expect(result).toEqual({ ok: false, status: 400, error: "Hearts can only be sent to creators." });
  });
});
