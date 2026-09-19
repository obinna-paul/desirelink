jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 })),
  },
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({ prisma: { profile: { update: jest.fn() } } }));

import { getServerSession } from "next-auth";

import { PATCH } from "@/app/api/profile/match-priority/route";
import { prisma } from "@/lib/prisma";

const mockSession = getServerSession as jest.Mock;
const mockUpdate = prisma.profile.update as jest.Mock;

function request(priority: unknown) {
  return new Request("http://localhost/api/profile/match-priority", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priority }),
  });
}

describe("PATCH /api/profile/match-priority", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("persists a supported match priority", async () => {
    mockUpdate.mockResolvedValue({ matchPriority: "SPARK" });

    const response = await PATCH(request("SPARK"));

    expect(response).toMatchObject({ status: 200, body: { matchPriority: "SPARK" } });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { matchPriority: "SPARK" },
      select: { matchPriority: true },
    });
  });

  it("rejects unsupported values", async () => {
    const response = await PATCH(request("TONIGHT"));

    expect(response).toMatchObject({ status: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
