jest.mock("@/lib/prisma", () => ({ prisma: { circleMember: { findMany: jest.fn() } } }));

import {
  buildPermissionFieldNames,
  desirePermissionKey,
  getProfileVisibility,
  parseDesirePermissionKey,
} from "@/lib/circles";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  circleMember: { findMany: jest.Mock };
};

describe("privacy logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("round-trips desire permission keys", () => {
    expect(desirePermissionKey("Dinner")).toBe("desire:Dinner");
    expect(parseDesirePermissionKey("desire:Dinner")).toBe("Dinner");
    expect(parseDesirePermissionKey("bio")).toBeNull();
  });

  it("builds mixed profile and desire permission fields", () => {
    expect(buildPermissionFieldNames({ profileFields: ["bio", "location"], desireCategories: ["Dinner"] })).toEqual([
      "bio",
      "location",
      "desire:Dinner",
    ]);
  });

  it("shows only public profile fields to anonymous viewers", async () => {
    await expect(getProfileVisibility("owner-1", null, false)).resolves.toEqual({
      profileFields: ["bio"],
      desireCategories: [],
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
            { fieldName: "desire:Travel", visible: true },
            { fieldName: "identity", visible: false },
          ],
        },
      },
    ]);

    await expect(getProfileVisibility("owner-1", "viewer-1", false)).resolves.toEqual({
      profileFields: ["bio", "location"],
      desireCategories: ["Travel"],
      circleNames: ["Close friends"],
    });
  });
});
