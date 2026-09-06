jest.mock("@/lib/prisma", () => {
  const liveStream = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  return {
    prisma: {
      profile: { findUnique: jest.fn() },
      liveStream,
      $transaction: jest.fn(async (work: (tx: { liveStream: typeof liveStream }) => unknown) => work({ liveStream })),
    },
  };
});
jest.mock("@/lib/provider-types", () => ({
  CREATOR_PROFILE_TYPES: ["CREATOR"],
  isProviderProfileType: jest.fn(() => true),
}));
jest.mock("@/lib/livekit", () => ({
  isLiveKitConfigured: jest.fn(() => true),
  getLiveKitUrl: jest.fn(() => "wss://livekit.test"),
  createLiveKitToken: jest.fn(async () => "token"),
}));
jest.mock("@/lib/pusher-server", () => ({ triggerEvent: jest.fn() }));
jest.mock("@/lib/hearts", () => ({ settleGift: jest.fn() }));
jest.mock("@/lib/live-requests", () => ({ refundOpenLiveRequests: jest.fn() }));
jest.mock("@/lib/notifications", () => ({ createNotificationsBulk: jest.fn() }));
jest.mock("@/lib/subscription-access", () => ({ getActiveSubscriberIds: jest.fn() }));
jest.mock("@/lib/verification", () => ({ hasIdentityOnFile: jest.fn(async () => true) }));

import {
  cancelScheduledLiveStream,
  getLiveStreamPageState,
  getScheduledStreamForProvider,
  processScheduledLiveStreams,
  scheduleLiveStream,
  startLiveStream,
} from "@/lib/live-streams";
import { prisma } from "@/lib/prisma";
import { createNotificationsBulk } from "@/lib/notifications";
import { getActiveSubscriberIds } from "@/lib/subscription-access";

const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock };
  liveStream: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};
const mockCreateNotificationsBulk = createNotificationsBulk as jest.Mock;
const mockGetActiveSubscriberIds = getActiveSubscriberIds as jest.Mock;

const provider = {
  id: "creator-1",
  displayName: "Ada",
  profileType: "CREATOR",
};

describe("scheduled live lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-09-06T10:00:00.000Z"));
    mockPrisma.profile.findUnique.mockResolvedValue(provider);
    mockGetActiveSubscriberIds.mockResolvedValue(["fan-1"]);
    mockCreateNotificationsBulk.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates one scheduled stream in a serializable transaction and announces it", async () => {
    const scheduledFor = new Date("2026-09-06T12:00:00.000Z");
    mockPrisma.liveStream.findFirst.mockResolvedValue(null);
    mockPrisma.liveStream.create.mockResolvedValue({
      id: "live-1",
      roomName: "room-1",
      title: "Sunday live",
      scheduledFor,
    });

    const result = await scheduleLiveStream("creator-1", "Sunday live", scheduledFor);

    expect(result).toEqual({
      ok: true,
      stream: {
        id: "live-1",
        roomName: "room-1",
        title: "Sunday live",
        scheduledFor: scheduledFor.toISOString(),
      },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(mockCreateNotificationsBulk).toHaveBeenCalledWith([
      expect.objectContaining({ recipientId: "fan-1", href: "/live/live-1" }),
    ]);
  });

  it("does not report scheduling as failed when only notification delivery fails", async () => {
    const scheduledFor = new Date("2026-09-06T12:00:00.000Z");
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockPrisma.liveStream.findFirst.mockResolvedValue(null);
    mockPrisma.liveStream.create.mockResolvedValue({
      id: "live-1",
      roomName: "room-1",
      title: "Sunday live",
      scheduledFor,
    });
    mockCreateNotificationsBulk.mockRejectedValueOnce(new Error("notification database unavailable"));

    const result = await scheduleLiveStream("creator-1", "Sunday live", scheduledFor);

    expect(result.ok).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("blocks a second active or scheduled stream", async () => {
    mockPrisma.liveStream.findFirst.mockResolvedValue({ id: "existing-live" });

    const result = await scheduleLiveStream(
      "creator-1",
      "Another live",
      new Date("2026-09-06T12:00:00.000Z"),
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "You already have a live stream in progress or scheduled.",
    });
    expect(mockPrisma.liveStream.create).not.toHaveBeenCalled();
  });

  it("promotes the scheduled row and always sends the actual start alert", async () => {
    mockPrisma.liveStream.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "live-1" });
    mockPrisma.liveStream.update.mockResolvedValue({
      id: "live-1",
      roomName: "room-1",
      title: "Sunday live",
    });

    const result = await startLiveStream("creator-1", "Sunday live", [], null, false);

    expect(result.ok).toBe(true);
    expect(mockPrisma.liveStream.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "live-1", status: "scheduled" },
        data: expect.objectContaining({ status: "live", scheduledFor: null, title: "Sunday live" }),
      }),
    );
    expect(mockCreateNotificationsBulk).toHaveBeenCalledWith([
      expect.objectContaining({ title: "Ada is live", href: "/live/live-1" }),
    ]);
  });

  it("cancels atomically and informs the current audience", async () => {
    mockPrisma.liveStream.findUnique.mockResolvedValue({
      providerId: "creator-1",
      status: "scheduled",
      title: "Sunday live",
      provider: { displayName: "Ada" },
    });
    mockPrisma.liveStream.updateMany.mockResolvedValue({ count: 1 });

    const result = await cancelScheduledLiveStream("creator-1", "live-1");

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.liveStream.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "live-1", providerId: "creator-1", status: "scheduled" } }),
    );
    expect(mockCreateNotificationsBulk).toHaveBeenCalledWith([
      expect.objectContaining({ title: "Ada cancelled a scheduled live" }),
    ]);
  });

  it("expires stale schedules before reminding upcoming ones and claims each transition once", async () => {
    mockPrisma.liveStream.findMany
      .mockResolvedValueOnce([
        {
          id: "expired-live",
          title: "Missed live",
          providerId: "creator-1",
          scheduledFor: new Date("2026-09-06T07:00:00.000Z"),
          provider: { displayName: "Ada" },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "soon-live",
          title: "Soon live",
          providerId: "creator-1",
          scheduledFor: new Date("2026-09-06T10:05:00.000Z"),
          provider: { displayName: "Ada" },
        },
      ]);
    mockPrisma.liveStream.updateMany.mockResolvedValue({ count: 1 });

    const result = await processScheduledLiveStreams();

    expect(result).toEqual({ expired: 1, notified: 1 });
    expect(mockPrisma.liveStream.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: "expired-live", status: "scheduled" } }),
    );
    expect(mockPrisma.liveStream.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "soon-live", status: "scheduled", startingSoonNotifiedAt: null },
      }),
    );
    expect(mockCreateNotificationsBulk).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ recipientId: "creator-1", href: "/live/go" }),
        expect.objectContaining({ recipientId: "fan-1", href: "/live/soon-live" }),
      ]),
    );
  });

  it("fails closed instead of crashing on malformed scheduled rows", async () => {
    mockPrisma.liveStream.findUnique.mockResolvedValue({
      id: "live-1",
      title: "Broken live",
      status: "scheduled",
      roomName: "room-1",
      startedAt: new Date(),
      scheduledFor: null,
      totalHeartsReceived: 0,
      heartGoal: null,
      requestOptions: [],
      provider: { id: "creator-1", username: "ada", displayName: "Ada", avatarUrl: "" },
    });

    await expect(getLiveStreamPageState("live-1", null)).resolves.toEqual({ state: "ended" });
  });

  it("only returns a scheduled row with a real time", async () => {
    const scheduledFor = new Date("2026-09-06T12:00:00.000Z");
    mockPrisma.liveStream.findFirst.mockResolvedValue({ id: "live-1", title: "Sunday live", scheduledFor });

    const result = await getScheduledStreamForProvider("creator-1");

    expect(result?.scheduledFor).toEqual(scheduledFor);
    expect(mockPrisma.liveStream.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerId: "creator-1", status: "scheduled", scheduledFor: { not: null } },
        orderBy: { scheduledFor: "asc" },
      }),
    );
  });
});
