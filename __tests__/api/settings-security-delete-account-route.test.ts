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
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock("bcryptjs", () => ({ compare: jest.fn() }));
jest.mock("@/lib/account-deletion", () => ({ deleteOwnAccount: jest.fn() }));
jest.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 })),
  rateLimitHeaders: jest.fn(() => ({})),
}));

import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";

import { POST } from "@/app/api/settings/security/delete-account/route";
import { prisma } from "@/lib/prisma";
import { deleteOwnAccount } from "@/lib/account-deletion";

const mockSession = getServerSession as jest.Mock;
const mockPrisma = prisma as unknown as { user: { findUnique: jest.Mock } };
const mockCompare = bcrypt.compare as jest.Mock;
const mockDelete = deleteOwnAccount as jest.Mock;

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/settings/security/delete-account", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockDelete.mockResolvedValue({ ok: true });
  });

  it("rejects an unauthenticated request", async () => {
    mockSession.mockResolvedValue(null);

    const response = await POST(postRequest({ confirmUsername: "ada" }));

    expect(response).toMatchObject({ status: 401 });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("rejects a confirmUsername that doesn't match the account", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: null, profile: { username: "ada" } });

    const response = await POST(postRequest({ confirmUsername: "not-ada" }));

    expect(response).toMatchObject({ status: 400, body: { error: "That username doesn't match your account" } });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("matches confirmUsername case-insensitively", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: null, profile: { username: "Ada" } });

    const response = await POST(postRequest({ confirmUsername: "ADA" }));

    expect(response).toMatchObject({ status: 200 });
    expect(mockDelete).toHaveBeenCalledWith("user-1");
  });

  it("requires a password for an account that has one", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: "hash", profile: { username: "ada" } });

    const response = await POST(postRequest({ confirmUsername: "ada" }));

    expect(response).toMatchObject({ status: 400, body: { error: "Enter your password" } });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("rejects an incorrect password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: "hash", profile: { username: "ada" } });
    mockCompare.mockResolvedValue(false);

    const response = await POST(postRequest({ confirmUsername: "ada", password: "wrong" }));

    expect(response).toMatchObject({ status: 400, body: { error: "Incorrect password" } });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes the account once username and password both check out", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: "hash", profile: { username: "ada" } });
    mockCompare.mockResolvedValue(true);

    const response = await POST(postRequest({ confirmUsername: "ada", password: "correct" }));

    expect(mockDelete).toHaveBeenCalledWith("user-1");
    expect(response).toMatchObject({ status: 200 });
  });

  it("surfaces the error and status deleteOwnAccount returns on failure", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: null, profile: { username: "ada" } });
    mockDelete.mockResolvedValue({ ok: false, status: 400, error: "Admin accounts can't be deleted from here - hand off admin access first." });

    const response = await POST(postRequest({ confirmUsername: "ada" }));

    expect(response).toMatchObject({ status: 400, body: { error: "Admin accounts can't be deleted from here - hand off admin access first." } });
  });

  it("404s when the account or profile doesn't exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await POST(postRequest({ confirmUsername: "ada" }));

    expect(response).toMatchObject({ status: 404 });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
