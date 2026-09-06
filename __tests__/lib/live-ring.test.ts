jest.mock("@/lib/prisma", () => ({
  prisma: {
    liveStream: { findMany: jest.fn() },
    profile: { findUnique: jest.fn(), findMany: jest.fn() },
    creatorAffinity: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/pusher-server", () => ({ triggerEvent: jest.fn() }));
jest.mock("@/lib/livekit", () => ({
  isLiveKitConfigured: jest.fn(() => false),
  getLiveKitUrl: jest.fn(() => "wss://example.test"),
  createLiveKitToken: jest.fn(async () => "mock-token"),
}));
jest.mock("@/lib/hearts", () => ({ settleGift: jest.fn() }));

import { getLiveRingFeed } from "@/lib/live-streams";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  liveStream: { findMany: jest.Mock };
  profile: { findUnique: jest.Mock; findMany: jest.Mock };
  creatorAffinity: { findMany: jest.Mock };
};

const NOW = new Date("2026-09-06T12:00:00.000Z");
const LAGOS = { locationLat: 6.5, locationLng: 3.3 };
const NYC = { locationLat: 40.7, locationLng: -74.0 };
const NO_LOCATION = { locationLat: 0, locationLng: 0 };

function liveRow(providerId: string, totalHeartsReceived = 0, providerOverrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: `stream-${providerId}`,
    totalHeartsReceived,
    provider: {
      id: providerId,
      username: providerId,
      displayName: providerId,
      avatarUrl: "",
      createdAt: NOW,
      ...NO_LOCATION,
      ...providerOverrides,
    },
  };
}

function profileRow(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return { id, username: id, displayName: id, avatarUrl: "", createdAt: NOW, ...NO_LOCATION, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.liveStream.findMany.mockResolvedValue([]);
  mockPrisma.profile.findMany.mockResolvedValue([]);
  mockPrisma.profile.findUnique.mockResolvedValue(null);
  mockPrisma.creatorAffinity.findMany.mockResolvedValue([]);
});

describe("getLiveRingFeed", () => {
  it("returns an empty ring with no live streams or online providers", async () => {
    const result = await getLiveRingFeed(null, 20, NOW);
    expect(result).toEqual([]);
  });

  it("applies isSuspended/showInSearch eligibility filters to both queries", async () => {
    await getLiveRingFeed("viewer-1", 20, NOW);

    expect(mockPrisma.liveStream.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "live",
          provider: expect.objectContaining({ isIncognito: false, isSuspended: false, showInSearch: true }),
        }),
      }),
    );
    expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isIncognito: false, isSuspended: false, showInSearch: true }),
      }),
    );
  });

  it("ranks a creator the viewer has higher affinity toward above one with lower affinity", async () => {
    mockPrisma.liveStream.findMany.mockResolvedValue([liveRow("low-affinity"), liveRow("high-affinity")]);
    mockPrisma.creatorAffinity.findMany.mockResolvedValue([
      { creatorId: "low-affinity", affinity: 5 },
      { creatorId: "high-affinity", affinity: 60 },
    ]);

    const result = await getLiveRingFeed("viewer-1", 20, NOW);

    expect(result.map((r) => r.id)).toEqual(["high-affinity", "low-affinity"]);
  });

  it("ranks higher live-stream momentum (hearts received) above lower, all else equal", async () => {
    mockPrisma.liveStream.findMany.mockResolvedValue([liveRow("quiet", 0), liveRow("popular", 200)]);

    const result = await getLiveRingFeed("viewer-1", 20, NOW);

    expect(result.map((r) => r.id)).toEqual(["popular", "quiet"]);
  });

  it("ranks a newer account above an older one, all else equal", async () => {
    const oldAccount = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000);
    mockPrisma.profile.findMany.mockResolvedValue([
      profileRow("veteran", { createdAt: oldAccount, lastActiveAt: NOW }),
      profileRow("newcomer", { createdAt: NOW, lastActiveAt: NOW }),
    ]);

    const result = await getLiveRingFeed("viewer-1", 20, NOW);

    expect(result.map((r) => r.id)).toEqual(["newcomer", "veteran"]);
  });

  it("ranks a closer online provider above a distant one when the viewer has a location", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(LAGOS);
    mockPrisma.profile.findMany.mockResolvedValue([
      profileRow("far", { ...NYC, lastActiveAt: NOW }),
      profileRow("near", { ...LAGOS, lastActiveAt: NOW }),
    ]);

    const result = await getLiveRingFeed("viewer-1", 20, NOW);

    expect(result.map((r) => r.id)).toEqual(["near", "far"]);
  });

  it("always shows live entries ahead of online-only entries, even if an online candidate outscores every live one", async () => {
    mockPrisma.liveStream.findMany.mockResolvedValue([liveRow("just-live")]);
    mockPrisma.profile.findMany.mockResolvedValue([profileRow("super-relevant", { lastActiveAt: NOW })]);
    mockPrisma.creatorAffinity.findMany.mockResolvedValue([{ creatorId: "super-relevant", affinity: 1000 }]);

    const result = await getLiveRingFeed("viewer-1", 20, NOW);

    expect(result).toEqual([
      expect.objectContaining({ id: "just-live", isLive: true }),
      expect.objectContaining({ id: "super-relevant", isLive: false }),
    ]);
  });

  it("fills remaining slots with online providers once live entries are exhausted", async () => {
    mockPrisma.liveStream.findMany.mockResolvedValue([liveRow("only-live")]);
    mockPrisma.profile.findMany.mockResolvedValue([profileRow("only-online", { lastActiveAt: NOW })]);

    const result = await getLiveRingFeed("viewer-1", 2, NOW);

    expect(result.map((r) => ({ id: r.id, isLive: r.isLive }))).toEqual([
      { id: "only-live", isLive: true },
      { id: "only-online", isLive: false },
    ]);
  });

  it("is deterministic within the same session bucket for tied scores", async () => {
    mockPrisma.liveStream.findMany.mockResolvedValue([liveRow("a"), liveRow("b"), liveRow("c")]);

    const first = await getLiveRingFeed("viewer-1", 20, NOW);
    const second = await getLiveRingFeed("viewer-1", 20, NOW);

    expect(first.map((r) => r.id)).toEqual(second.map((r) => r.id));
  });
});
