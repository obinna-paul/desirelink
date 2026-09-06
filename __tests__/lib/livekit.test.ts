const mockAddGrant = jest.fn();
const mockToJwt = jest.fn(async () => "mock-token");

jest.mock("livekit-server-sdk", () => ({
  AccessToken: jest.fn(() => ({
    addGrant: mockAddGrant,
    toJwt: mockToJwt,
  })),
}));

describe("LiveKit broadcast permissions", () => {
  const originalEnvironment = {
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    LIVEKIT_URL: process.env.LIVEKIT_URL,
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.LIVEKIT_API_KEY = "test-key";
    process.env.LIVEKIT_API_SECRET = "test-secret";
    process.env.LIVEKIT_URL = "wss://live.example.test";
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("makes audience members subscribe-only", async () => {
    const { createLiveKitToken } = await import("@/lib/livekit");
    await createLiveKitToken({
      roomName: "live-room",
      identity: "viewer-1",
      name: "Viewer",
      canPublish: false,
    });

    expect(mockAddGrant).toHaveBeenCalledWith({
      room: "live-room",
      roomJoin: true,
      canPublish: false,
      canPublishData: false,
      canSubscribe: true,
    });
  });

  it("keeps publishing available to the host", async () => {
    const { createLiveKitToken } = await import("@/lib/livekit");
    await createLiveKitToken({
      roomName: "live-room",
      identity: "host-1",
      name: "Host",
      canPublish: true,
    });

    expect(mockAddGrant).toHaveBeenCalledWith({
      room: "live-room",
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });
  });
});
