import {
  classifyBunnyVideoUploadState,
  signBunnyUpload,
  verifyBunnyUploadAuthorization,
} from "@/lib/bunny-stream";

describe("Bunny Stream upload authorization", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-18T12:00:00.000Z"));
    process.env = {
      ...originalEnv,
      BUNNY_STREAM_LIBRARY_ID: "12345",
      BUNNY_STREAM_API_KEY: "test-api-key",
      BUNNY_STREAM_CDN_HOSTNAME: "videos.example.test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.useRealTimers();
  });

  it("keeps a maximum-size premium upload authorized for slow connections", () => {
    const signed = signBunnyUpload("video-id", 50 * 1024 * 1024 * 1024);
    const lifetimeSeconds = signed.authorizationExpire - Math.floor(Date.now() / 1000);

    expect(lifetimeSeconds).toBeGreaterThanOrEqual(11 * 24 * 60 * 60);
    expect(lifetimeSeconds).toBeLessThanOrEqual(14 * 24 * 60 * 60);
    expect(verifyBunnyUploadAuthorization(signed)).toBe(true);
  });

  it("treats provider-side upload evidence as accepted and explicit error states as failed", () => {
    expect(
      classifyBunnyVideoUploadState({ status: 2, storageSize: 0, hasOriginal: false, encodeProgress: 1 }),
    ).toBe("accepted");
    expect(
      classifyBunnyVideoUploadState({ status: 0, storageSize: 1_024, hasOriginal: false, encodeProgress: 0 }),
    ).toBe("incomplete");
    expect(
      classifyBunnyVideoUploadState({ status: 0, storageSize: 1_024, hasOriginal: true, encodeProgress: 0 }),
    ).toBe("accepted");
    expect(
      classifyBunnyVideoUploadState({ status: 6, storageSize: 0, hasOriginal: false, encodeProgress: 0 }),
    ).toBe("failed");
    expect(
      classifyBunnyVideoUploadState({ status: 0, storageSize: 0, hasOriginal: false, encodeProgress: 0 }),
    ).toBe("incomplete");
  });
});
