jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn() },
  },
}));
jest.mock("@/lib/username", () => ({ isUsernameAvailable: jest.fn().mockResolvedValue(true) }));
jest.mock("@/lib/email/notifications", () => ({ sendSignupOtpEmail: jest.fn().mockResolvedValue(true) }));
jest.mock("@/lib/spec-test", () => ({
  linkSpecTestResultToProfile: jest.fn().mockResolvedValue(undefined),
  claimSpecTestResultById: jest.fn().mockResolvedValue(undefined),
}));
const mockCookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
jest.mock("next/headers", () => ({ cookies: () => mockCookieStore }));

import { POST } from "@/app/api/signup/route";
import { prisma } from "@/lib/prisma";
import { linkSpecTestResultToProfile, claimSpecTestResultById } from "@/lib/spec-test";

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock };
};
const mockLinkByEmail = linkSpecTestResultToProfile as jest.Mock;
const mockClaimById = claimSpecTestResultById as jest.Mock;

function postSignup(overrides: Record<string, unknown> = {}, ip: string) {
  const suffix = ip.replace(/\./g, "");
  return POST(
    new Request("http://localhost/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({
        name: "Alex",
        username: `alex${suffix}`,
        email: `alex-${suffix}@example.com`,
        password: "correct-horse-battery-staple",
        confirmPassword: "correct-horse-battery-staple",
        profileType: "EXPLORER",
        ...overrides,
      }),
    }),
  );
}

describe("POST /api/signup - spec test claim wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ profile: { id: "profile-new" } });
  });

  it("claims a Spec Test result by the claim cookie's id, regardless of the signup email, and clears the cookie", async () => {
    mockCookieStore.get.mockReturnValue({ value: "anon-result-1" });

    const response = await postSignup({}, "203.0.113.60");

    expect(response.status).toBe(201);
    expect(mockClaimById).toHaveBeenCalledWith("anon-result-1", "profile-new");
    expect(mockCookieStore.delete).toHaveBeenCalledWith("spec_test_result_id");
    // The email-based path still runs too - the two are independent, not either/or.
    expect(mockLinkByEmail).toHaveBeenCalled();
  });

  it("skips the cookie claim entirely when no claim cookie is present - e.g. never took the quiz", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const response = await postSignup({}, "203.0.113.61");

    expect(response.status).toBe(201);
    expect(mockClaimById).not.toHaveBeenCalled();
    expect(mockCookieStore.delete).not.toHaveBeenCalled();
    // Still attempted, in case this exact email matches an unclaimed result.
    expect(mockLinkByEmail).toHaveBeenCalled();
  });
});
