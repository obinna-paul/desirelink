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

import { getServerSession } from "next-auth";

import { POST } from "@/app/api/onboarding/gender/route";
import { prisma } from "@/lib/prisma";

const mockSession = getServerSession as jest.Mock;
const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock; update: jest.Mock };
};

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/onboarding/gender", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("rejects an unauthenticated request", async () => {
    mockSession.mockResolvedValue(null);

    const response = await POST(postRequest({ gender: "Woman" }));

    expect(response).toMatchObject({ status: 401 });
    expect(mockPrisma.profile.update).not.toHaveBeenCalled();
  });

  it("sets the chosen gender", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1" });
    mockPrisma.profile.update.mockResolvedValue({ id: "profile-1" });

    const response = await POST(postRequest({ gender: "Woman" }));

    expect(response).toMatchObject({ status: 200 });
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: { gender: "Woman" },
    });
  });

  it("rejects a gender outside the known option list", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1" });

    const response = await POST(postRequest({ gender: "unspecified" }));

    expect(response).toMatchObject({ status: 400 });
    expect(mockPrisma.profile.update).not.toHaveBeenCalled();
  });

  it("404s when the profile doesn't exist", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    const response = await POST(postRequest({ gender: "Man" }));

    expect(response).toMatchObject({ status: 404 });
    expect(mockPrisma.profile.update).not.toHaveBeenCalled();
  });
});
