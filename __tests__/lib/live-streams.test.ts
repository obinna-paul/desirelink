jest.mock("@/lib/prisma", () => ({
  prisma: {
    liveStream: { findUnique: jest.fn(), update: jest.fn() },
    profile: { findUnique: jest.fn(), update: jest.fn() },
    gift: { create: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));
jest.mock("@/lib/pusher-server", () => ({ triggerEvent: jest.fn() }));
jest.mock("@/lib/livekit", () => ({
  isLiveKitConfigured: jest.fn(() => false),
  getLiveKitUrl: jest.fn(() => "wss://example.test"),
  createLiveKitToken: jest.fn(async () => "mock-token"),
}));

import { sendGift, GIFT_PROVIDER_SHARE } from "@/lib/live-streams";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  liveStream: { findUnique: jest.Mock; update: jest.Mock };
  profile: { findUnique: jest.Mock; update: jest.Mock };
  gift: { create: jest.Mock };
};

describe("sendGift", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a non-positive or non-integer gift amount", async () => {
    const result = await sendGift("stream-1", "sender-1", 0);
    expect(result).toEqual({ ok: false, status: 400, error: "Invalid gift amount." });
    expect(mockPrisma.liveStream.findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the stream has ended", async () => {
    mockPrisma.liveStream.findUnique.mockResolvedValue({ id: "stream-1", status: "ended", providerId: "provider-1" });

    const result = await sendGift("stream-1", "sender-1", 10);
    expect(result).toEqual({ ok: false, status: 404, error: "This stream has ended." });
  });

  it("rejects a provider gifting their own stream", async () => {
    mockPrisma.liveStream.findUnique.mockResolvedValue({ id: "stream-1", status: "live", providerId: "provider-1" });

    const result = await sendGift("stream-1", "provider-1", 10);
    expect(result).toEqual({ ok: false, status: 400, error: "You can't send yourself a gift." });
  });

  it("rejects when the sender doesn't have enough hearts", async () => {
    mockPrisma.liveStream.findUnique.mockResolvedValue({ id: "stream-1", status: "live", providerId: "provider-1" });
    mockPrisma.profile.findUnique.mockResolvedValue({ heartsBalance: 5, username: "u", displayName: "U", avatarUrl: "" });

    const result = await sendGift("stream-1", "sender-1", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(402);
  });

  it("splits the gift's value between sender debit and the provider's share on success", async () => {
    mockPrisma.liveStream.findUnique.mockResolvedValue({ id: "stream-1", status: "live", providerId: "provider-1" });
    mockPrisma.profile.findUnique.mockResolvedValue({
      heartsBalance: 100,
      username: "sender",
      displayName: "Sender",
      avatarUrl: "",
    });
    mockPrisma.profile.update.mockResolvedValueOnce({ heartsBalance: 90 }).mockResolvedValueOnce({});
    mockPrisma.liveStream.update.mockResolvedValue({});
    mockPrisma.gift.create.mockResolvedValue({});

    const result = await sendGift("stream-1", "sender-1", 10);

    expect(result).toEqual({ ok: true, heartsBalance: 90, hearts: 10 });
    expect(mockPrisma.gift.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        streamId: "stream-1",
        senderId: "sender-1",
        receiverId: "provider-1",
        hearts: 10,
        valueCents: 10,
        providerShareCents: Math.round(10 * GIFT_PROVIDER_SHARE),
      }),
    });
  });
});
