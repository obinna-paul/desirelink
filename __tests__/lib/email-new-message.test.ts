jest.mock("@/lib/prisma", () => ({
  prisma: { message: { findFirst: jest.fn() }, profile: { findUnique: jest.fn() } },
}));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));

import { notifyNewMessageByEmail } from "@/lib/email/messages";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";

const mockPrisma = prisma as unknown as {
  message: { findFirst: jest.Mock };
  profile: { findUnique: jest.Mock };
};
const mockSendEmail = sendEmail as jest.Mock;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const baseParams = {
  messageId: "message-2",
  senderId: "sender-1",
  senderUsername: "amara",
  senderDisplayName: "Amara",
  recipientId: "recipient-1",
  content: "Hey, are you free tonight?",
  mediaType: null,
};

describe("notifyNewMessageByEmail", () => {
  beforeEach(() => jest.clearAllMocks());

  it("emails the recipient when this is the only unread message from the sender", async () => {
    mockPrisma.message.findFirst.mockResolvedValue(null);
    mockPrisma.profile.findUnique.mockResolvedValue({ user: { email: "recipient@example.com" } });

    notifyNewMessageByEmail(baseParams);
    await flush();
    await flush();

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "recipient@example.com",
        subject: "Amara sent you a message",
        category: "messages",
        template: "new-message",
      }),
    );
  });

  it("stays quiet when an older unread message from the same sender already exists", async () => {
    mockPrisma.message.findFirst.mockResolvedValue({ id: "older-unread" });

    notifyNewMessageByEmail(baseParams);
    await flush();
    await flush();

    expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips a placeholder (X sign-in, no real email yet) address", async () => {
    mockPrisma.message.findFirst.mockResolvedValue(null);
    mockPrisma.profile.findUnique.mockResolvedValue({ user: { email: "abc123@no-email.udala.pro" } });

    notifyNewMessageByEmail(baseParams);
    await flush();
    await flush();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("uses a media label as the preview when the message has no text", async () => {
    mockPrisma.message.findFirst.mockResolvedValue(null);
    mockPrisma.profile.findUnique.mockResolvedValue({ user: { email: "recipient@example.com" } });

    notifyNewMessageByEmail({ ...baseParams, content: "", mediaType: "image" });
    await flush();
    await flush();

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.react.props.preview).toBe("Sent a photo");
  });
});
