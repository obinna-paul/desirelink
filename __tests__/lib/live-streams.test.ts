jest.mock("@/lib/prisma", () => ({
  prisma: {
    liveStream: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock("@/lib/pusher-server", () => ({ triggerEvent: jest.fn() }));
jest.mock("@/lib/livekit", () => ({
  isLiveKitConfigured: jest.fn(() => false),
  getLiveKitUrl: jest.fn(() => "wss://example.test"),
  createLiveKitToken: jest.fn(async () => "mock-token"),
}));
jest.mock("@/lib/hearts", () => ({ settleGift: jest.fn() }));

import { sendGift } from "@/lib/live-streams";
import { settleGift } from "@/lib/hearts";
import { prisma } from "@/lib/prisma";
import { triggerEvent } from "@/lib/pusher-server";

const mockPrisma = prisma as unknown as {
  liveStream: { findUnique: jest.Mock; update: jest.Mock };
};
const mockSettleGift = settleGift as jest.Mock;
const mockTriggerEvent = triggerEvent as jest.Mock;

describe("sendGift", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects when the stream has ended", async () => {
    mockPrisma.liveStream.findUnique.mockResolvedValue({ id: "stream-1", status: "ended", providerId: "provider-1" });

    const result = await sendGift("stream-1", "sender-1", 10);
    expect(result).toEqual({ ok: false, status: 404, error: "This stream has ended." });
    expect(mockSettleGift).not.toHaveBeenCalled();
  });

  it("delegates to settleGift with the stream's provider as receiver, then updates the stream and broadcasts", async () => {
    mockPrisma.liveStream.findUnique.mockResolvedValue({ id: "stream-1", status: "live", providerId: "provider-1" });
    mockSettleGift.mockResolvedValue({
      ok: true,
      heartsBalance: 90,
      hearts: 10,
      giftId: "gift-1",
      sender: { username: "sender", displayName: "Sender", avatarUrl: "" },
    });
    mockPrisma.liveStream.update.mockResolvedValue({});

    const result = await sendGift("stream-1", "sender-1", 10);

    expect(mockSettleGift).toHaveBeenCalledWith({
      senderId: "sender-1",
      receiverId: "provider-1",
      hearts: 10,
      context: "live_stream",
      streamId: "stream-1",
    });
    expect(mockPrisma.liveStream.update).toHaveBeenCalledWith({
      where: { id: "stream-1" },
      data: { totalHeartsReceived: { increment: 10 } },
    });
    expect(mockTriggerEvent).toHaveBeenCalledWith(
      "presence-live-stream-1",
      "gift-sent",
      expect.objectContaining({ hearts: 10 })
    );
    expect(result).toEqual({ ok: true, heartsBalance: 90, hearts: 10 });
  });

  it("passes through a settleGift failure without touching the stream", async () => {
    mockPrisma.liveStream.findUnique.mockResolvedValue({ id: "stream-1", status: "live", providerId: "provider-1" });
    mockSettleGift.mockResolvedValue({ ok: false, status: 402, error: "Not enough hearts. Buy more to keep sending gifts." });

    const result = await sendGift("stream-1", "sender-1", 10);

    expect(result).toEqual({ ok: false, status: 402, error: "Not enough hearts. Buy more to keep sending gifts." });
    expect(mockPrisma.liveStream.update).not.toHaveBeenCalled();
  });
});
