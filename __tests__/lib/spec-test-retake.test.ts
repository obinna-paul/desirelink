jest.mock("@/lib/prisma", () => ({
  prisma: { specTestResult: { findFirst: jest.fn() } },
}));

import { getActiveRetakeCooldown, RETAKE_COOLDOWN_MS } from "@/lib/spec-test/retake";
import { prisma } from "@/lib/prisma";

const mockFindFirst = (prisma as unknown as { specTestResult: { findFirst: jest.Mock } }).specTestResult.findFirst;

describe("getActiveRetakeCooldown", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when the profile has no prior result", async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await getActiveRetakeCooldown("profile-1")).toBeNull();
  });

  it("returns null once the 30-day cooldown has elapsed", async () => {
    mockFindFirst.mockResolvedValue({ id: "old-result", createdAt: new Date(Date.now() - RETAKE_COOLDOWN_MS - 1000) });
    expect(await getActiveRetakeCooldown("profile-1")).toBeNull();
  });

  it("returns the blocking result's id and eligibility date while still within the cooldown", async () => {
    const createdAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    mockFindFirst.mockResolvedValue({ id: "recent-result", createdAt });

    const result = await getActiveRetakeCooldown("profile-1");

    expect(result).not.toBeNull();
    expect(result!.resultId).toBe("recent-result");
    expect(result!.nextEligibleAt.getTime()).toBe(createdAt.getTime() + RETAKE_COOLDOWN_MS);
  });
});
