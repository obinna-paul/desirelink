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
  prisma: { profile: { findUnique: jest.fn() } },
}));
jest.mock("@/lib/verification", () => ({ hasIdentityOnFile: jest.fn() }));
jest.mock("@/lib/messages", () => ({ sendMessage: jest.fn() }));

import { getServerSession } from "next-auth";

import { POST } from "@/app/api/messages/send/route";
import { prisma } from "@/lib/prisma";
import { hasIdentityOnFile } from "@/lib/verification";
import { sendMessage } from "@/lib/messages";

const mockSession = getServerSession as jest.Mock;
const mockPrisma = prisma as unknown as { profile: { findUnique: jest.Mock } };
const mockHasIdentityOnFile = hasIdentityOnFile as jest.Mock;
const mockSendMessage = sendMessage as jest.Mock;

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/messages/send - identity gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "sender-1" });
  });

  it("blocks an unverified sender with a distinct code, without attempting to send", async () => {
    mockHasIdentityOnFile.mockResolvedValue(false);

    const response = await POST(postRequest({ recipientId: "recipient-1", content: "hey" }));

    expect(response).toMatchObject({
      status: 403,
      body: { code: "IDENTITY_VERIFICATION_REQUIRED" },
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("sends the message once the sender has identity on file", async () => {
    mockHasIdentityOnFile.mockResolvedValue(true);
    mockSendMessage.mockResolvedValue({ ok: true, message: { id: "message-1" } });

    const response = await POST(postRequest({ recipientId: "recipient-1", content: "hey" }));

    expect(mockSendMessage).toHaveBeenCalledWith("sender-1", "recipient-1", "hey", null, null);
    expect(response).toMatchObject({ status: 201, body: { message: { id: "message-1" } } });
  });
});
