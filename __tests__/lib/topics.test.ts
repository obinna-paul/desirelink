jest.mock("@/lib/prisma", () => ({
  prisma: {
    topic: { findMany: jest.fn() },
    profileTopic: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
  },
}));

import { setProfileInterests, MAX_INTERESTS_PER_PROFILE } from "@/lib/topics";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  topic: { findMany: jest.Mock };
  profileTopic: { findMany: jest.Mock; deleteMany: jest.Mock; createMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("setProfileInterests", () => {
  it("clears existing interests and creates nothing when given an empty list", async () => {
    await setProfileInterests("profile-1", []);

    expect(mockPrisma.topic.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.profileTopic.deleteMany).toHaveBeenCalledWith({
      where: { profileId: "profile-1" },
    });
    expect(mockPrisma.profileTopic.createMany).not.toHaveBeenCalled();
  });

  it("drops ids that aren't real topics", async () => {
    mockPrisma.topic.findMany.mockResolvedValue([{ id: "topic-fitness" }]);

    await setProfileInterests("profile-1", ["topic-fitness", "not-a-real-id"]);

    expect(mockPrisma.topic.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["topic-fitness", "not-a-real-id"] } },
      select: { id: true },
    });
    expect(mockPrisma.profileTopic.createMany).toHaveBeenCalledWith({
      data: [{ profileId: "profile-1", topicId: "topic-fitness" }],
      skipDuplicates: true,
    });
  });

  it("dedupes repeated ids before validating", async () => {
    mockPrisma.topic.findMany.mockResolvedValue([{ id: "topic-fitness" }]);

    await setProfileInterests("profile-1", ["topic-fitness", "topic-fitness"]);

    expect(mockPrisma.topic.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["topic-fitness"] } },
      select: { id: true },
    });
  });

  it("caps at MAX_INTERESTS_PER_PROFILE before querying", async () => {
    const manyIds = Array.from({ length: MAX_INTERESTS_PER_PROFILE + 5 }, (_, i) => `topic-${i}`);
    mockPrisma.topic.findMany.mockResolvedValue(
      manyIds.slice(0, MAX_INTERESTS_PER_PROFILE).map((id) => ({ id })),
    );

    await setProfileInterests("profile-1", manyIds);

    const queriedIds = mockPrisma.topic.findMany.mock.calls[0][0].where.id.in;
    expect(queriedIds).toHaveLength(MAX_INTERESTS_PER_PROFILE);
  });

  it("always deletes existing rows before recreating them", async () => {
    mockPrisma.topic.findMany.mockResolvedValue([{ id: "topic-fitness" }]);

    await setProfileInterests("profile-1", ["topic-fitness"]);

    const deleteOrder = mockPrisma.profileTopic.deleteMany.mock.invocationCallOrder[0];
    const createOrder = mockPrisma.profileTopic.createMany.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });
});
