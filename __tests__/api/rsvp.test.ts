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
jest.mock("@/lib/prisma", () => ({
  prisma: { profile: { findUnique: jest.fn() }, event: { findUnique: jest.fn() } },
}));
jest.mock("@/lib/rsvp", () => ({
  isRsvpAction: (value: unknown) => ["going", "interested", "not_going"].includes(String(value)),
  setRsvp: jest.fn(),
}));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { POST } from "@/app/api/events/[id]/rsvp/route";
import { prisma } from "@/lib/prisma";
import { setRsvp } from "@/lib/rsvp";
import { createNotification } from "@/lib/notifications";
import { getServerSession } from "next-auth";

const mockGetServerSession = jest.mocked(getServerSession);
const mockSetRsvp = jest.mocked(setRsvp);
const mockCreateNotification = jest.mocked(createNotification);
const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock };
  event: { findUnique: jest.Mock };
};

function request(body: unknown) {
  return new Request("http://localhost/api/events/event-1/rsvp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/events/[id]/rsvp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(request({ status: "going" }), { params: { id: "event-1" } });

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
  });

  it("validates RSVP status", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1" });

    const response = await POST(request({ status: "maybe" }), { params: { id: "event-1" } });

    await expect(response.json()).resolves.toEqual({ error: "Invalid RSVP status" });
    expect(response.status).toBe(400);
  });

  it("updates RSVP for authenticated users", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1", displayName: "Ada" });
    mockPrisma.event.findUnique.mockResolvedValue({ hostId: "host-1", title: "Rooftop mixer" });
    mockSetRsvp.mockResolvedValue({ ok: true, state: "updated", status: "going", message: "Saved" });

    const response = await POST(request({ status: "going" }), { params: { id: "event-1" } });

    expect(mockSetRsvp).toHaveBeenCalledWith("profile-1", "event-1", "going", {
      successUrl: "http://localhost/events/event-1",
      cancelUrl: "http://localhost/events/event-1",
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "host-1", actorId: "profile-1", type: "rsvp" })
    );
    await expect(response.json()).resolves.toEqual({ state: "updated", status: "going", message: "Saved" });
    expect(response.status).toBe(200);
  });
});
