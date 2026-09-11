jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({
  prisma: { profile: { findUnique: jest.fn(), update: jest.fn() } },
}));
jest.mock("@/lib/reputation", () => ({
  recalculateReputation: jest.fn().mockResolvedValue({ score: 0, isTrustedMember: false }),
}));
jest.mock("@/lib/search", () => ({ syncProfileSearchDocument: jest.fn().mockResolvedValue(undefined) }));

import { getServerSession } from "next-auth";

import { PATCH } from "@/app/api/profile/route";
import { prisma } from "@/lib/prisma";

const mockSession = getServerSession as jest.Mock;
const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock; update: jest.Mock };
};

const VALID_PROFILE_FIELDS = {
  displayName: "Alex",
  bio: "",
  avatarUrl: "",
  gender: "woman",
  orientation: "straight",
  locationLat: 0,
  locationLng: 0,
  city: "",
  country: "",
  serviceCategories: [],
  isVerified: false,
  openToChat: true,
  openToMeet: true,
  showInSearch: true,
  showExactLocation: false,
  showActivityStatus: true,
  isIncognito: false,
};

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/profile - account type upgrade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.profile.update.mockResolvedValue({ id: "profile-1", ...VALID_PROFILE_FIELDS });
  });

  it("allows a Seeker to switch to Creator, same as an Explorer", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1", profileType: "SEEKER" });

    const response = await PATCH(patchRequest({ ...VALID_PROFILE_FIELDS, profileType: "CREATOR" }));

    expect(response).toMatchObject({ status: 200 });
    expect(mockPrisma.profile.update).toHaveBeenCalled();
  });

  it("still refuses a Creator switching back to Explorer or Seeker", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1", profileType: "CREATOR" });

    const response = await PATCH(patchRequest({ ...VALID_PROFILE_FIELDS, profileType: "SEEKER" }));

    expect(response).toMatchObject({
      status: 400,
      body: { error: "Only switching to a creator account type is allowed" },
    });
    expect(mockPrisma.profile.update).not.toHaveBeenCalled();
  });

  it("refuses switching directly between Explorer and Seeker", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1", profileType: "EXPLORER" });

    const response = await PATCH(patchRequest({ ...VALID_PROFILE_FIELDS, profileType: "SEEKER" }));

    expect(response).toMatchObject({ status: 400 });
    expect(mockPrisma.profile.update).not.toHaveBeenCalled();
  });
});
