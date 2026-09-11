jest.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));
jest.mock("@/lib/email/otp", () => ({ issueOtp: jest.fn() }));

import { sendWelcomeEmail } from "@/lib/email/notifications";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";

const mockPrisma = prisma as unknown as { user: { findUnique: jest.Mock } };
const mockSendEmail = sendEmail as jest.Mock;

describe("sendWelcomeEmail - each account type gets a persona-appropriate welcome", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends welcome-seeker to a Seeker, not the Explorer (content-watching) copy", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      email: "seeker@example.com",
      name: "Sam Seeker",
      profile: { profileType: "SEEKER", city: "Lagos" },
    });

    await sendWelcomeEmail("user-1");

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ template: "welcome-seeker" }));
  });

  it("still sends welcome-creator to a Creator", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      email: "creator@example.com",
      name: "Cara Creator",
      profile: { profileType: "CREATOR", city: "Lagos" },
    });

    await sendWelcomeEmail("user-2");

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ template: "welcome-creator" }));
  });

  it("still sends welcome-explorer to an Explorer", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      email: "explorer@example.com",
      name: "Eva Explorer",
      profile: { profileType: "EXPLORER", city: "Lagos" },
    });

    await sendWelcomeEmail("user-3");

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ template: "welcome-explorer" }));
  });
});
