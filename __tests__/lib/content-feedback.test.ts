jest.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: jest.fn() },
    profile: { findUnique: jest.fn() },
    postFeedback: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    hiddenCreator: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

import {
  recordPostFeedback,
  hideCreator,
  unhideCreator,
  getHiddenCreatorIds,
  getNotInterestedPostIds,
} from "@/lib/content-feedback";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  post: { findUnique: jest.Mock };
  profile: { findUnique: jest.Mock };
  postFeedback: { upsert: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock };
  hiddenCreator: { upsert: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("recordPostFeedback", () => {
  it("rejects feedback on a post that doesn't exist", async () => {
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const result = await recordPostFeedback("viewer-1", "post-1", "interested");

    expect(result).toEqual({ ok: false, status: 404, error: "Post not found" });
    expect(mockPrisma.postFeedback.upsert).not.toHaveBeenCalled();
  });

  it("upserts feedback idempotently on success", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ id: "post-1" });

    const result = await recordPostFeedback("viewer-1", "post-1", "not_interested");

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.postFeedback.deleteMany).toHaveBeenCalledWith({
      where: { viewerId: "viewer-1", postId: "post-1", kind: "interested" },
    });
    expect(mockPrisma.postFeedback.upsert).toHaveBeenCalledWith({
      where: {
        viewerId_postId_kind: { viewerId: "viewer-1", postId: "post-1", kind: "not_interested" },
      },
      create: { viewerId: "viewer-1", postId: "post-1", kind: "not_interested" },
      update: {},
    });
  });

  it("returns posts the viewer explicitly marked not interested", async () => {
    mockPrisma.postFeedback.findMany.mockResolvedValue([{ postId: "post-2" }]);

    await expect(getNotInterestedPostIds("viewer-1")).resolves.toEqual(["post-2"]);
    expect(mockPrisma.postFeedback.findMany).toHaveBeenCalledWith({
      where: { viewerId: "viewer-1", kind: "not_interested" },
      select: { postId: true },
    });
  });
});

describe("hideCreator", () => {
  it("rejects hiding yourself without querying anything", async () => {
    const result = await hideCreator("viewer-1", "viewer-1");

    expect(result).toEqual({ ok: false, status: 400, error: "You can't hide yourself" });
    expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.hiddenCreator.upsert).not.toHaveBeenCalled();
  });

  it("rejects hiding a creator that doesn't exist", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    const result = await hideCreator("viewer-1", "creator-1");

    expect(result).toEqual({ ok: false, status: 404, error: "Profile not found" });
    expect(mockPrisma.hiddenCreator.upsert).not.toHaveBeenCalled();
  });

  it("upserts the hidden-creator row idempotently on success", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "creator-1" });

    const result = await hideCreator("viewer-1", "creator-1");

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.hiddenCreator.upsert).toHaveBeenCalledWith({
      where: { viewerId_creatorId: { viewerId: "viewer-1", creatorId: "creator-1" } },
      create: { viewerId: "viewer-1", creatorId: "creator-1" },
      update: {},
    });
  });
});

describe("unhideCreator", () => {
  it("deletes the matching hidden-creator row", async () => {
    const result = await unhideCreator("viewer-1", "creator-1");

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.hiddenCreator.deleteMany).toHaveBeenCalledWith({
      where: { viewerId: "viewer-1", creatorId: "creator-1" },
    });
  });
});

describe("getHiddenCreatorIds", () => {
  it("maps hidden-creator rows to creator ids", async () => {
    mockPrisma.hiddenCreator.findMany.mockResolvedValue([
      { creatorId: "creator-1" },
      { creatorId: "creator-2" },
    ]);

    await expect(getHiddenCreatorIds("viewer-1")).resolves.toEqual(["creator-1", "creator-2"]);
    expect(mockPrisma.hiddenCreator.findMany).toHaveBeenCalledWith({
      where: { viewerId: "viewer-1" },
      select: { creatorId: true },
    });
  });
});
