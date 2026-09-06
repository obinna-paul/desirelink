jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findMany: jest.fn() },
  },
}));

import { getNearbyActiveSnapshot } from "@/lib/availability";
import { prisma } from "@/lib/prisma";

const mockFindMany = prisma.profile.findMany as jest.Mock;

describe("nearby active snapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not invent nearby activity when the viewer has no location", async () => {
    await expect(
      getNearbyActiveSnapshot({ id: "viewer", locationLat: 0, locationLng: 0 }),
    ).resolves.toEqual({ locationReady: false, onlineCount: 0, radiusKm: 50, items: [] });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("counts only candidates inside the real 50 km radius", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    mockFindMany.mockResolvedValue([
      {
        id: "near-with-status",
        username: "nearby",
        displayName: "Nearby Member",
        avatarUrl: "/near.jpg",
        locationLat: 6.53,
        locationLng: 3.38,
        availabilityStatuses: [{ status: "chatting_only", expiresAt }],
      },
      {
        id: "near-without-status",
        username: "quiet",
        displayName: "Quiet Member",
        avatarUrl: "/quiet.jpg",
        locationLat: 6.6,
        locationLng: 3.45,
        availabilityStatuses: [],
      },
      {
        id: "far-away",
        username: "far",
        displayName: "Far Member",
        avatarUrl: "/far.jpg",
        locationLat: 9.08,
        locationLng: 7.4,
        availabilityStatuses: [{ status: "available_tonight", expiresAt }],
      },
    ]);

    const snapshot = await getNearbyActiveSnapshot({
      id: "viewer",
      locationLat: 6.5244,
      locationLng: 3.3792,
    });

    expect(snapshot.onlineCount).toBe(2);
    expect(snapshot.items).toEqual([
      expect.objectContaining({ id: "near-with-status", status: "chatting_only" }),
    ]);
  });

  it("queries only privacy-approved, discoverable, unblocked profiles", async () => {
    mockFindMany.mockResolvedValue([]);

    await getNearbyActiveSnapshot({ id: "viewer", locationLat: 6.5244, locationLng: 3.3792 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "viewer" },
          isIncognito: false,
          isSuspended: false,
          showInSearch: true,
          showActivityStatus: true,
          blocksReceived: { none: { blockerId: "viewer" } },
          blocksMade: { none: { blockedId: "viewer" } },
          lastActiveAt: { gte: expect.any(Date) },
        }),
      }),
    );
  });
});
