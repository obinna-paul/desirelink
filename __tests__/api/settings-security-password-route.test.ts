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
  prisma: { user: { findUnique: jest.fn(), update: jest.fn() } },
}));
jest.mock("@/lib/email/notifications", () => ({ sendPasswordChangedEmail: jest.fn() }));
jest.mock("bcryptjs", () => ({ compare: jest.fn(), hash: jest.fn() }));
// This file makes several same-user calls, which would otherwise trip the real limiter's
// shared in-memory bucket (it isn't reset between test cases in the same file).
jest.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 })),
  rateLimitHeaders: jest.fn(() => ({})),
}));

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";

import { POST } from "@/app/api/settings/security/password/route";
import { prisma } from "@/lib/prisma";
import { sendPasswordChangedEmail } from "@/lib/email/notifications";

const mockSession = getServerSession as jest.Mock;
const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; update: jest.Mock };
};
const mockCompare = bcrypt.compare as jest.Mock;
const mockHash = bcrypt.hash as jest.Mock;

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/settings/security/password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockHash.mockResolvedValue("new-hash");
  });

  it("rejects an unauthenticated request", async () => {
    mockSession.mockResolvedValue(null);

    const response = await POST(postRequest({ newPassword: "longenough1" }));

    expect(response).toMatchObject({ status: 401 });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a new password shorter than 8 characters", async () => {
    const response = await POST(postRequest({ newPassword: "short" }));

    expect(response).toMatchObject({ status: 400 });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("requires the current password when the account already has one", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: "a@b.com", passwordHash: "old-hash" });

    const response = await POST(postRequest({ newPassword: "longenough1" }));

    expect(response).toMatchObject({ status: 400, body: { error: "Enter your current password" } });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: "a@b.com", passwordHash: "old-hash" });
    mockCompare.mockResolvedValue(false);

    const response = await POST(postRequest({ currentPassword: "wrong", newPassword: "longenough1" }));

    expect(response).toMatchObject({ status: 400, body: { error: "Current password is incorrect" } });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("updates the password and sends a confirmation email when the current password matches", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: "a@b.com", passwordHash: "old-hash" });
    mockCompare.mockResolvedValue(true);

    const response = await POST(postRequest({ currentPassword: "correct", newPassword: "longenough1" }));

    expect(response).toMatchObject({ status: 200 });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "new-hash" },
    });
    expect(sendPasswordChangedEmail).toHaveBeenCalledWith("a@b.com");
  });

  it("lets an OAuth-only account set a first password without a current-password check", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: "a@b.com", passwordHash: null });

    const response = await POST(postRequest({ newPassword: "longenough1" }));

    expect(response).toMatchObject({ status: 200 });
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "new-hash" },
    });
  });

  it("404s when the account doesn't exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await POST(postRequest({ newPassword: "longenough1" }));

    expect(response).toMatchObject({ status: 404 });
  });
});
