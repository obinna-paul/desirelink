jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
    postReaction: { count: jest.fn() },
    postComment: { count: jest.fn() },
    providerSubscription: { count: jest.fn(), findMany: jest.fn() },
    post: { findFirst: jest.fn() },
  },
}));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));
jest.mock("@/lib/email/unsubscribe", () => ({
  isUnsubscribeConfigured: jest.fn().mockReturnValue(true),
  unsubscribeUrlFor: jest.fn().mockReturnValue("https://udala.example/unsubscribe?token=t"),
}));

import { renderToStaticMarkup } from "react-dom/server";

import { runWeeklyDigest, runWinBack } from "@/lib/email/growth-jobs";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";

const mockPrisma = prisma as unknown as {
  profile: { findMany: jest.Mock; update: jest.Mock; count: jest.Mock };
};
const mockSendEmail = sendEmail as jest.Mock;

describe("runWeeklyDigest - Seeker gets a people-oriented digest, not a creator-recruitment one", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profile.update.mockResolvedValue({});
  });

  it("sends the seeker variant, counting new Seekers rather than new creators", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      { id: "profile-1", profileType: "SEEKER", country: "NG", user: { email: "a@example.com", name: "Ada" } },
    ]);
    mockPrisma.profile.count.mockResolvedValue(3);

    await runWeeklyDigest();

    expect(mockPrisma.profile.count).toHaveBeenCalledWith({
      where: { profileType: "SEEKER", country: "NG", createdAt: { gte: expect.any(Date) } },
    });
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.template).toBe("weekly-digest-seeker");
    expect(call.react.props.preview).toBe("3 new people joined this week");
  });

  it("still sends the explorer variant (new-creator count) to Explorers", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      { id: "profile-2", profileType: "EXPLORER", country: "NG", user: { email: "b@example.com", name: "Bo" } },
    ]);
    mockPrisma.profile.count.mockResolvedValue(5);

    await runWeeklyDigest();

    expect(mockPrisma.profile.count).toHaveBeenCalledWith({
      where: { profileType: "CREATOR", country: "NG", createdAt: { gte: expect.any(Date) } },
    });
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.template).toBe("weekly-digest-explorer");
    expect(call.react.props.preview).toBe("5 new creators joined this week");
  });
});

describe("runWinBack - Seeker gets a people-count hook, not a creator-count one", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profile.update.mockResolvedValue({});
  });

  it("passes audience: 'people' and a Seeker-scoped count for a Seeker", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      {
        id: "profile-1",
        country: "NG",
        profileType: "SEEKER",
        lastActiveAt: null,
        winBackSentAt: null,
        user: { email: "a@example.com", name: "Ada" },
      },
    ]);
    mockPrisma.profile.count.mockResolvedValue(4);

    await runWinBack();

    expect(mockPrisma.profile.count).toHaveBeenCalledWith({
      where: { profileType: "SEEKER", country: "NG", createdAt: { gte: expect.any(Date) } },
    });
    const html = renderToStaticMarkup(mockSendEmail.mock.calls[0][0].react);
    expect(html).toContain("4 new people have joined");
  });

  it("still passes audience: 'creators' for an Explorer", async () => {
    mockPrisma.profile.findMany.mockResolvedValue([
      {
        id: "profile-2",
        country: "NG",
        profileType: "EXPLORER",
        lastActiveAt: null,
        winBackSentAt: null,
        user: { email: "b@example.com", name: "Bo" },
      },
    ]);
    mockPrisma.profile.count.mockResolvedValue(2);

    await runWinBack();

    expect(mockPrisma.profile.count).toHaveBeenCalledWith({
      where: { profileType: "CREATOR", country: "NG", createdAt: { gte: expect.any(Date) } },
    });
    const html = renderToStaticMarkup(mockSendEmail.mock.calls[0][0].react);
    expect(html).toContain("2 new creators have joined");
  });
});
