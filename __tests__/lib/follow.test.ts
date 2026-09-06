jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findUnique: jest.fn() },
    follow: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    block: { findFirst: jest.fn() },
  },
}));

import { followProfile, unfollowProfile, isFollowing, getFollowingIds } from "@/lib/follow";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock };
  follow: {
    upsert: jest.Mock;
    deleteMany: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
  block: { findFirst: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("followProfile", () => {
  it("rejects following yourself without querying anything", async () => {
    const result = await followProfile("viewer-1", "viewer-1");

    expect(result).toEqual({ ok: false, status: 400, error: "You can't follow yourself" });
    expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.follow.upsert).not.toHaveBeenCalled();
  });

  it("rejects when the target profile doesn't exist", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    const result = await followProfile("viewer-1", "creator-1");

    expect(result).toEqual({ ok: false, status: 404, error: "Profile not found" });
    expect(mockPrisma.follow.upsert).not.toHaveBeenCalled();
  });

  it("rejects when either profile has blocked the other", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "creator-1" });
    mockPrisma.block.findFirst.mockResolvedValue({ id: "block-1" });

    const result = await followProfile("viewer-1", "creator-1");

    expect(result).toEqual({ ok: false, status: 403, error: "You can't follow this profile" });
    expect(mockPrisma.follow.upsert).not.toHaveBeenCalled();
  });

  it("upserts the follow row idempotently on success", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "creator-1" });
    mockPrisma.block.findFirst.mockResolvedValue(null);

    const result = await followProfile("viewer-1", "creator-1");

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.follow.upsert).toHaveBeenCalledWith({
      where: { followerId_followingId: { followerId: "viewer-1", followingId: "creator-1" } },
      create: { followerId: "viewer-1", followingId: "creator-1" },
      update: {},
    });
  });
});

describe("unfollowProfile", () => {
  it("deletes the matching follow row", async () => {
    const result = await unfollowProfile("viewer-1", "creator-1");

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.follow.deleteMany).toHaveBeenCalledWith({
      where: { followerId: "viewer-1", followingId: "creator-1" },
    });
  });
});

describe("isFollowing", () => {
  it("returns true when a follow row exists", async () => {
    mockPrisma.follow.findUnique.mockResolvedValue({ id: "follow-1" });

    await expect(isFollowing("viewer-1", "creator-1")).resolves.toBe(true);
    expect(mockPrisma.follow.findUnique).toHaveBeenCalledWith({
      where: { followerId_followingId: { followerId: "viewer-1", followingId: "creator-1" } },
      select: { id: true },
    });
  });

  it("returns false when no follow row exists", async () => {
    mockPrisma.follow.findUnique.mockResolvedValue(null);

    await expect(isFollowing("viewer-1", "creator-1")).resolves.toBe(false);
  });
});

describe("getFollowingIds", () => {
  it("maps follow rows to the followed profile ids", async () => {
    mockPrisma.follow.findMany.mockResolvedValue([
      { followingId: "creator-1" },
      { followingId: "creator-2" },
    ]);

    await expect(getFollowingIds("viewer-1")).resolves.toEqual(["creator-1", "creator-2"]);
    expect(mockPrisma.follow.findMany).toHaveBeenCalledWith({
      where: { followerId: "viewer-1" },
      select: { followingId: true },
    });
  });
});
