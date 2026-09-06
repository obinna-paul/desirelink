jest.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: jest.fn() },
    savedPost: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
  },
}));

import { savePost, unsavePost, getSavedPostIds } from "@/lib/saved-posts";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  post: { findUnique: jest.Mock };
  savedPost: { upsert: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("savePost", () => {
  it("rejects saving a post that doesn't exist", async () => {
    mockPrisma.post.findUnique.mockResolvedValue(null);

    const result = await savePost("viewer-1", "post-1");

    expect(result).toEqual({ ok: false, status: 404, error: "Post not found" });
    expect(mockPrisma.savedPost.upsert).not.toHaveBeenCalled();
  });

  it("upserts the saved-post row idempotently on success", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ id: "post-1" });

    const result = await savePost("viewer-1", "post-1");

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.savedPost.upsert).toHaveBeenCalledWith({
      where: { viewerId_postId: { viewerId: "viewer-1", postId: "post-1" } },
      create: { viewerId: "viewer-1", postId: "post-1" },
      update: {},
    });
  });
});

describe("unsavePost", () => {
  it("deletes the matching saved-post row", async () => {
    const result = await unsavePost("viewer-1", "post-1");

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.savedPost.deleteMany).toHaveBeenCalledWith({
      where: { viewerId: "viewer-1", postId: "post-1" },
    });
  });
});

describe("getSavedPostIds", () => {
  it("maps saved-post rows to post ids, newest-saved first", async () => {
    mockPrisma.savedPost.findMany.mockResolvedValue([{ postId: "post-2" }, { postId: "post-1" }]);

    await expect(getSavedPostIds("viewer-1")).resolves.toEqual(["post-2", "post-1"]);
    expect(mockPrisma.savedPost.findMany).toHaveBeenCalledWith({
      where: { viewerId: "viewer-1" },
      select: { postId: true },
      orderBy: { createdAt: "desc" },
    });
  });
});
