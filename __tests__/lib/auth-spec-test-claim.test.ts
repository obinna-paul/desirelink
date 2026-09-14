jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findUnique: jest.fn() },
    specTestResult: { findFirst: jest.fn() },
  },
}));
jest.mock("@/lib/spec-test", () => ({
  linkSpecTestResultToProfile: jest.fn().mockResolvedValue(undefined),
  claimSpecTestResultById: jest.fn().mockResolvedValue(undefined),
}));
const mockCookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
jest.mock("next/headers", () => ({ cookies: () => mockCookieStore }));

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { linkSpecTestResultToProfile, claimSpecTestResultById } from "@/lib/spec-test";

const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock };
  specTestResult: { findFirst: jest.Mock };
};
const mockLinkByEmail = linkSpecTestResultToProfile as jest.Mock;
const mockClaimById = claimSpecTestResultById as jest.Mock;

/** Exercises just the signIn callback, the way NextAuth invokes it after a successful
 *  credentials or OAuth authentication - account.provider "credentials" keeps
 *  ensureProfileForAuthUser's OAuth-only branch out of the way, isolating the
 *  claim-on-login behavior under test. */
function signIn(user: { id?: string; email?: string | null }) {
  const callback = authOptions.callbacks!.signIn as unknown as (args: {
    user: typeof user;
    account: { provider: string };
  }) => Promise<boolean>;
  return callback({ user, account: { provider: "credentials" } });
}

describe("lib/auth - Spec Test claim on login (not just new-account creation)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieStore.get.mockReturnValue(undefined);
  });

  it("claims a pending result by cookie and by email the first time an existing member becomes traceable", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1" });
    mockPrisma.specTestResult.findFirst.mockResolvedValue(null);
    mockCookieStore.get.mockReturnValue({ value: "anon-result-1" });

    await signIn({ id: "user-1", email: "Alex@Example.com" });

    expect(mockClaimById).toHaveBeenCalledWith("anon-result-1", "profile-1");
    expect(mockCookieStore.delete).toHaveBeenCalledWith("spec_test_result_id");
    // Both paths always attempted, same as at signup - covers a taker who never gave an
    // email (cookie-only) and one who gave an email but never used this exact browser again.
    expect(mockLinkByEmail).toHaveBeenCalledWith("alex@example.com", "profile-1");
  });

  it("does not claim anything once the profile already has a result - the existing result is what the member sees", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1" });
    mockPrisma.specTestResult.findFirst.mockResolvedValue({ id: "existing-result" });
    mockCookieStore.get.mockReturnValue({ value: "anon-result-2" });

    await signIn({ id: "user-1", email: "alex@example.com" });

    expect(mockClaimById).not.toHaveBeenCalled();
    expect(mockLinkByEmail).not.toHaveBeenCalled();
    // The cookie is left alone too - never inspected once a result already exists.
    expect(mockCookieStore.delete).not.toHaveBeenCalled();
  });

  it("is a no-op when there is no cookie and no email match, on a member with no existing result", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1" });
    mockPrisma.specTestResult.findFirst.mockResolvedValue(null);
    mockCookieStore.get.mockReturnValue(undefined);

    await signIn({ id: "user-1", email: "alex@example.com" });

    expect(mockClaimById).not.toHaveBeenCalled();
    // Still attempted - no cookie doesn't mean no email match is worth checking.
    expect(mockLinkByEmail).toHaveBeenCalledWith("alex@example.com", "profile-1");
  });

  it("never throws when the user has no profile yet (defensive - claim-on-login always runs after profile creation in practice)", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    await expect(signIn({ id: "user-1", email: "alex@example.com" })).resolves.toBe(true);

    expect(mockPrisma.specTestResult.findFirst).not.toHaveBeenCalled();
    expect(mockClaimById).not.toHaveBeenCalled();
    expect(mockLinkByEmail).not.toHaveBeenCalled();
  });

  it("never throws and never claims when the session user is missing an id or email", async () => {
    await expect(signIn({ id: undefined, email: "alex@example.com" })).resolves.toBe(true);
    await expect(signIn({ id: "user-1", email: null })).resolves.toBe(true);

    expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled();
    expect(mockClaimById).not.toHaveBeenCalled();
    expect(mockLinkByEmail).not.toHaveBeenCalled();
  });
});
