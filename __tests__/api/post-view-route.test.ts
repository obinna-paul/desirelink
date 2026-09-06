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
  prisma: {
    profile: { findUnique: jest.fn() },
    post: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { getServerSession } from "next-auth";

import { POST } from "@/app/api/posts/[postId]/view/route";
import { prisma } from "@/lib/prisma";

const mockSession = getServerSession as jest.Mock;
const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock };
  post: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

describe("POST /api/posts/[postId]/view", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "viewer-1" });
  });

  it("records one impression and returns the canonical count", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      authorId: "creator-1",
      viewCount: 11,
    });
    const tx = {
      postImpression: { create: jest.fn().mockResolvedValue({ id: "view-1" }) },
      post: { update: jest.fn().mockResolvedValue({ viewCount: 12 }) },
    };
    mockPrisma.$transaction.mockImplementation(
      (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: "forYou", sessionId: "session-1", position: 2, dwellMs: 1234 }),
      }),
      { params: { postId: "post-1" } },
    );

    expect(response).toMatchObject({
      body: { counted: true, count: 12 },
      status: 200,
    });
    expect(tx.postImpression.create).toHaveBeenCalledWith({
      data: {
        postId: "post-1",
        viewerId: "viewer-1",
        surface: "forYou",
        sessionId: "session-1",
        position: 2,
        dwellMs: 1234,
      },
    });
    expect(tx.post.update).toHaveBeenCalledWith({
      where: { id: "post-1" },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
  });

  it("does not count a creator viewing their own post", async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      authorId: "viewer-1",
      viewCount: 11,
    });

    const response = await POST(new Request("http://localhost"), {
      params: { postId: "post-1" },
    });

    expect(response).toMatchObject({
      body: { counted: false, count: 11 },
      status: 200,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
