jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      }),
  },
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({ prisma: { profile: { findUnique: jest.fn() } } }));
jest.mock("@/lib/premium", () => ({ subscribeToPremium: jest.fn() }));

import { POST } from "@/app/api/premium/subscribe/route";
import { prisma } from "@/lib/prisma";
import { subscribeToPremium } from "@/lib/premium";
import { getServerSession } from "next-auth";

const mockGetServerSession = jest.mocked(getServerSession);
const mockSubscribeToPremium = jest.mocked(subscribeToPremium);
const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock };
};

describe("POST /api/premium/subscribe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/premium/subscribe", { method: "POST" }));

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
  });

  it("returns checkout URL for authenticated users who need hosted checkout", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1" });
    mockSubscribeToPremium.mockResolvedValue({ ok: true, state: "checkout", checkoutUrl: "https://paystack.test/pay" });

    const response = await POST(new Request("http://localhost/api/premium/subscribe", { method: "POST" }));

    expect(mockSubscribeToPremium).toHaveBeenCalledWith("profile-1", {
      successUrl: "http://localhost/settings/billing",
      cancelUrl: "http://localhost/settings/billing",
    });
    await expect(response.json()).resolves.toEqual({
      state: "checkout",
      checkoutUrl: "https://paystack.test/pay",
    });
    expect(response.status).toBe(200);
  });
});
