jest.mock("@/lib/prisma", () => ({
  prisma: { specTestResult: { findMany: jest.fn() } },
}));

import { getSpecTestProfileResults } from "@/lib/spec-test";
import { prisma } from "@/lib/prisma";

const mockFindMany = (prisma as unknown as { specTestResult: { findMany: jest.Mock } }).specTestResult.findMany;

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "result-1",
    specType: "grounded_equal",
    secondarySpec: null,
    resultConfidence: "clear",
    gender: "male",
    instrumentVersion: "spec-v2.1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    profile: { id: "profile-1", username: "mara", displayName: "Mara Stone", avatarUrl: "" },
    ...overrides,
  };
}

describe("getSpecTestProfileResults", () => {
  beforeEach(() => jest.clearAllMocks());

  it("queries only results linked to a profile, most recent first", async () => {
    mockFindMany.mockResolvedValue([]);

    await getSpecTestProfileResults({ take: 10 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: { not: null } },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("maps each row to the taking member's profile and spec, without requiring an email", async () => {
    mockFindMany.mockResolvedValue([row()]);

    const { items } = await getSpecTestProfileResults({ take: 10 });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "result-1",
      specType: "grounded_equal",
      resultConfidence: "clear",
      gender: "male",
      profile: { username: "mara", displayName: "Mara Stone" },
    });
  });

  it("shows every attempt from the same member as its own row, not just the latest", async () => {
    mockFindMany.mockResolvedValue([
      row({ id: "result-2", createdAt: new Date("2026-02-01T00:00:00Z"), specType: "quiet_fire" }),
      row({ id: "result-1", createdAt: new Date("2026-01-01T00:00:00Z"), specType: "grounded_equal" }),
    ]);

    const { items } = await getSpecTestProfileResults({ take: 10 });

    expect(items.map((item) => item.id)).toEqual(["result-2", "result-1"]);
  });

  it("paginates with a cursor and reports whether more pages remain", async () => {
    const rows = Array.from({ length: 4 }, (_, i) => row({ id: `result-${i}` }));
    mockFindMany.mockResolvedValue(rows);

    const { items, nextCursor } = await getSpecTestProfileResults({ take: 3 });

    expect(items).toHaveLength(3);
    expect(nextCursor).toBe("result-2");

    mockFindMany.mockResolvedValue(rows.slice(0, 3));
    const { nextCursor: lastPageCursor } = await getSpecTestProfileResults({ take: 3 });
    expect(lastPageCursor).toBeNull();
  });
});
