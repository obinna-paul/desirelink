jest.mock("@/lib/prisma", () => ({
  prisma: {
    hashtag: { upsert: jest.fn() },
    postHashtag: { deleteMany: jest.fn(), createMany: jest.fn() },
  },
}));

import {
  extractHashtags,
  normalizeHashtag,
  syncPostHashtags,
  MAX_HASHTAGS_PER_POST,
} from "@/lib/hashtags";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  hashtag: { upsert: jest.Mock };
  postHashtag: { deleteMany: jest.Mock; createMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("normalizeHashtag", () => {
  it("lowercases and strips a leading #", () => {
    expect(normalizeHashtag("#DateNight")).toBe("datenight");
    expect(normalizeHashtag("DateNight")).toBe("datenight");
    expect(normalizeHashtag("  #trim  ")).toBe("trim");
  });
});

describe("extractHashtags", () => {
  it("extracts and normalizes hashtags in first-seen order", () => {
    expect(extractHashtags("Loving this #DateNight and #foodie vibe")).toEqual([
      "datenight",
      "foodie",
    ]);
  });

  it("dedupes repeated tags", () => {
    expect(extractHashtags("#foodie foodie again #foodie #Foodie")).toEqual(["foodie"]);
  });

  it("caps at MAX_HASHTAGS_PER_POST, dropping the rest", () => {
    const manyTags = Array.from({ length: MAX_HASHTAGS_PER_POST + 5 }, (_, i) => `#tag${i}`).join(
      " ",
    );
    expect(extractHashtags(manyTags)).toHaveLength(MAX_HASHTAGS_PER_POST);
  });

  it("returns an empty array when there are no hashtags", () => {
    expect(extractHashtags("just a plain caption")).toEqual([]);
  });

  it("ignores a bare # with nothing after it", () => {
    expect(extractHashtags("just a # symbol")).toEqual([]);
  });
});

describe("syncPostHashtags", () => {
  it("clears existing associations and creates nothing when the caption has no tags", async () => {
    await syncPostHashtags("post-1", "no tags here");

    expect(mockPrisma.postHashtag.deleteMany).toHaveBeenCalledWith({ where: { postId: "post-1" } });
    expect(mockPrisma.hashtag.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.postHashtag.createMany).not.toHaveBeenCalled();
  });

  it("upserts each hashtag and recreates the post's associations", async () => {
    mockPrisma.hashtag.upsert.mockImplementation(({ where }: { where: { tag: string } }) =>
      Promise.resolve({ id: `hashtag-${where.tag}`, tag: where.tag }),
    );

    await syncPostHashtags("post-1", "#foodie and #datenight");

    expect(mockPrisma.postHashtag.deleteMany).toHaveBeenCalledWith({ where: { postId: "post-1" } });
    expect(mockPrisma.hashtag.upsert).toHaveBeenCalledWith({
      where: { tag: "foodie" },
      create: { tag: "foodie" },
      update: {},
    });
    expect(mockPrisma.hashtag.upsert).toHaveBeenCalledWith({
      where: { tag: "datenight" },
      create: { tag: "datenight" },
      update: {},
    });
    expect(mockPrisma.postHashtag.createMany).toHaveBeenCalledWith({
      data: [
        { postId: "post-1", hashtagId: "hashtag-foodie" },
        { postId: "post-1", hashtagId: "hashtag-datenight" },
      ],
      skipDuplicates: true,
    });
  });
});
