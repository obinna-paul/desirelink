jest.mock("@/lib/prisma", () => ({ prisma: { circleMember: { findMany: jest.fn() } } }));

import { buildPermissionFieldNames, getProfileVisibility } from "@/lib/circles";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  circleMember: { findMany: jest.Mock };
};

describe("privacy logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds profile permission fields", () => {
    expect(buildPermissionFieldNames({ profileFields: ["bio", "location"] })).toEqual([
      "bio",
      "location",
    ]);
  });

  it("shows only public profile fields to anonymous viewers", async () => {
    await expect(getProfileVisibility("owner-1", null, false)).resolves.toEqual({
      profileFields: ["bio"],
      circleNames: [],
    });
    expect(mockPrisma.circleMember.findMany).not.toHaveBeenCalled();
  });

  it("adds circle permissions for known viewers", async () => {
    mockPrisma.circleMember.findMany.mockResolvedValue([
      {
        circle: {
          name: "Close friends",
          permissions: [
            { fieldName: "location", visible: true },
            { fieldName: "identity", visible: false },
          ],
        },
      },
    ]);

    await expect(getProfileVisibility("owner-1", "viewer-1", false)).resolves.toEqual({
      profileFields: ["bio", "location"],
      circleNames: ["Close friends"],
    });
  });
});
