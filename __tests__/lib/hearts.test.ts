jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findUnique: jest.fn(), update: jest.fn() },
    gift: { create: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));
jest.mock("@/lib/payments", () => ({ paymentProvider: {} }));
jest.mock("@/lib/payments/webhook-handler", () => ({ processPaymentEvent: jest.fn() }));

import { settleGift, sendHeartsToProvider } from "@/lib/hearts";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock; update: jest.Mock };
  gift: { create: jest.Mock };
};

describe("settleGift", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it("rejects when the sender doesn't have enough hearts", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ heartsBalance: 5, username: "u", displayName: "U", avatarUrl: "" });

    const result = await settleGift({ senderId: "a", receiverId: "b", hearts: 10, context: "profile" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(402);
  });

  it("credits the receiver's wallet at the gift's full value — no platform cut taken here", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      heartsBalance: 100,
      username: "sender",
      displayName: "Sender",
      avatarUrl: "",
    });
    mockPrisma.profile.update.mockResolvedValueOnce({ heartsBalance: 90 }).mockResolvedValueOnce({});
    mockPrisma.gift.create.mockResolvedValue({ id: "gift-1" });

    const result = await settleGift({ senderId: "a", receiverId: "b", hearts: 10, context: "profile" });

    expect(result).toEqual({
      ok: true,
      heartsBalance: 90,
      hearts: 10,
      giftId: "gift-1",
      sender: { username: "sender", displayName: "Sender", avatarUrl: "" },
    });
    expect(mockPrisma.profile.update).toHaveBeenNthCalledWith(2, {
      where: { id: "b" },
      data: { walletBalanceCents: { increment: 10 } },
    });
    expect(mockPrisma.gift.create).toHaveBeenCalledWith({
      data: { streamId: null, senderId: "a", receiverId: "b", hearts: 10, valueCents: 10, context: "profile" },
    });
  });
});

describe("sendHeartsToProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects sending hearts to a non-provider", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ profileType: "EXPLORER" });

    const result = await sendHeartsToProvider("a", "b", 10, "profile");

    expect(result).toEqual({ ok: false, status: 400, error: "Hearts can only be sent to providers." });
  });
});
