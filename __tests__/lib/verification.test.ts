jest.mock("@/lib/prisma", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    profile: { findUnique: jest.fn(), update: jest.fn() },
    verificationRequest: { findFirst: jest.fn(), create: jest.fn() },
  };
  prisma.$transaction = jest.fn((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
      : Promise.all(arg as Promise<unknown>[])
  );
  return { prisma };
});
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { submitVerificationRequest } from "@/lib/verification";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock; update: jest.Mock };
  verificationRequest: { findFirst: jest.Mock; create: jest.Mock };
};

function mockProfile(overrides: Partial<Record<string, unknown>> = {}) {
  mockPrisma.profile.findUnique.mockResolvedValue({
    profileType: "EXPLORER",
    isVerified: false,
    isVerifiedCreator: false,
    isVerifiedServiceProvider: false,
    ...overrides,
  });
}

describe("submitVerificationRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.verificationRequest.findFirst.mockResolvedValue(null);
    mockPrisma.verificationRequest.create.mockResolvedValue({ id: "req-1" });
    mockPrisma.profile.update.mockResolvedValue({});
  });

  it("lets a non-provider (Explorer or Seeker) submit a general 'member' identity request", async () => {
    mockProfile({ profileType: "EXPLORER" });

    const result = await submitVerificationRequest("profile-1", "member", "gov-id.jpg", "selfie.mp4");

    expect(result).toEqual({ ok: true, requestId: "req-1" });
    expect(mockPrisma.verificationRequest.create).toHaveBeenCalledWith({
      data: { profileId: "profile-1", requestType: "member", govIdUrl: "gov-id.jpg", selfieUrl: "selfie.mp4", status: "pending" },
    });
  });

  it("still requires a creator account for 'creator' and 'service_provider' requests", async () => {
    mockProfile({ profileType: "SEEKER" });

    const result = await submitVerificationRequest("profile-1", "creator", "gov-id.jpg", "selfie.mp4");

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Switch to a creator account before verifying",
    });
    expect(mockPrisma.verificationRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a 'member' request when already verified", async () => {
    mockProfile({ profileType: "SEEKER", isVerified: true });

    const result = await submitVerificationRequest("profile-1", "member", "gov-id.jpg", "selfie.mp4");

    expect(result).toEqual({ ok: false, status: 400, error: "You're already verified" });
    expect(mockPrisma.verificationRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate pending 'member' request", async () => {
    mockProfile({ profileType: "EXPLORER" });
    mockPrisma.verificationRequest.findFirst.mockResolvedValue({ id: "existing" });

    const result = await submitVerificationRequest("profile-1", "member", "gov-id.jpg", "selfie.mp4");

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "You already have a pending request of this type",
    });
  });
});
