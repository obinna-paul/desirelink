jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 })),
  },
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({ prisma: { profile: { updateMany: jest.fn() } } }));

import { getServerSession } from "next-auth";

import { POST } from "@/app/api/profile/first-post-nudge-seen/route";
import { prisma } from "@/lib/prisma";

const mockSession = getServerSession as jest.Mock;
const mockUpdateMany = prisma.profile.updateMany as jest.Mock;

describe("POST /api/profile/first-post-nudge-seen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("records the first reveal idempotently", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const response = await POST();

    expect(response).toMatchObject({ status: 200, body: { ok: true } });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        firstPostNudgeShownAt: null,
        posts: { none: {} },
      },
      data: { firstPostNudgeShownAt: expect.any(Date) },
    });
  });

  it("declines a stale or duplicate display claim", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const response = await POST();

    expect(response).toMatchObject({ status: 200, body: { ok: true, show: false } });
  });

  it("rejects an unauthenticated request", async () => {
    mockSession.mockResolvedValue(null);

    const response = await POST();

    expect(response).toMatchObject({ status: 401, body: { error: "Unauthorized" } });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});
