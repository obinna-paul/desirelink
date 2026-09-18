import {
  classifyBunnyVideoUploadState,
  getBunnyVideoIdFromPlaybackUrl,
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

  it("requires a rendition before treating a transferred video as playable", () => {
    expect(
      classifyBunnyVideoUploadState({ status: 2, storageSize: 0, hasOriginal: true, encodeProgress: 10, availableResolutions: null }),
    ).toBe("processing");
    expect(
      classifyBunnyVideoUploadState({ status: 7, storageSize: 0, hasOriginal: true, encodeProgress: 10, availableResolutions: null }),
    ).toBe("processing");
    expect(
      classifyBunnyVideoUploadState({ status: 8, storageSize: 0, hasOriginal: true, encodeProgress: 90, availableResolutions: "240p,360p" }),
    ).toBe("playable");
    expect(
      classifyBunnyVideoUploadState({ status: 0, storageSize: 1_024, hasOriginal: false, encodeProgress: 0, availableResolutions: null }),
    ).toBe("incomplete");
    expect(
      classifyBunnyVideoUploadState({ status: 4, storageSize: 1_024, hasOriginal: true, encodeProgress: 100, availableResolutions: "240p" }),
    ).toBe("playable");
    expect(
      classifyBunnyVideoUploadState({ status: 6, storageSize: 0, hasOriginal: false, encodeProgress: 0, availableResolutions: null }),
    ).toBe("failed");
    expect(
      classifyBunnyVideoUploadState({ status: 0, storageSize: 0, hasOriginal: false, encodeProgress: 0, availableResolutions: null }),
    ).toBe("incomplete");
  });

  it("only extracts playback ids from this library's configured CDN", () => {
    expect(
      getBunnyVideoIdFromPlaybackUrl(
        "https://videos.example.test/cd54b416-fa26-44fe-b794-db1bbb474514/playlist.m3u8",
      ),
    ).toBe("cd54b416-fa26-44fe-b794-db1bbb474514");
    expect(
      getBunnyVideoIdFromPlaybackUrl(
        "https://other.example.test/cd54b416-fa26-44fe-b794-db1bbb474514/playlist.m3u8",
      ),
    ).toBeNull();
  });
});
