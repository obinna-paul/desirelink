import {
  formatPlaybackTime,
  getVideoPosterUrl,
  getVideoTapZone,
  isHlsVideoSource,
  isVideoNotPublishedYet,
  probeVideoManifest,
  scrubFractionFromPointer,
  videoProcessingRetryDelayMs,
} from "@/lib/video-playback";

describe("video playback helpers", () => {
  it("recognizes HLS sources with cache or access query parameters", () => {
    expect(isHlsVideoSource("https://video.example.test/id/playlist.m3u8?token=abc")).toBe(true);
    expect(isHlsVideoSource("https://video.example.test/id/video.mp4")).toBe(false);
  });

  it("derives the Bunny poster without dropping URL parameters", () => {
    expect(getVideoPosterUrl("https://vz.example.test/id/playlist.m3u8?token=abc")).toBe(
      "https://vz.example.test/id/thumbnail.jpg?token=abc",
    );
  });

  it("does not invent a poster for ordinary video sources", () => {
    expect(getVideoPosterUrl("https://video.example.test/video.mp4")).toBeUndefined();
  });

  it("separates rewind, neutral, and fast-forward tap zones", () => {
    const frame = { left: 100, width: 300 };
    expect(getVideoTapZone(140, frame)).toBe("backward");
    expect(getVideoTapZone(250, frame)).toBe("center");
    expect(getVideoTapZone(360, frame)).toBe("forward");
  });

  it("formats short clips as minutes:seconds", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(7)).toBe("0:07");
    expect(formatPlaybackTime(65)).toBe("1:05");
    expect(formatPlaybackTime(599.8)).toBe("9:59");
  });

  it("adds an hours segment once a video actually runs that long", () => {
    // The premium ceiling this scrub bar exists for - a bare minutes readout would show
    // a meaningless "142:07" here.
    expect(formatPlaybackTime(60 * 60)).toBe("1:00:00");
    expect(formatPlaybackTime(3725)).toBe("1:02:05");
    expect(formatPlaybackTime(4 * 60 * 60 - 1)).toBe("3:59:59");
  });

  it("never renders a negative or non-finite time", () => {
    expect(formatPlaybackTime(-5)).toBe("0:00");
    expect(formatPlaybackTime(NaN)).toBe("0:00");
    expect(formatPlaybackTime(Infinity)).toBe("0:00");
  });

  it("maps a pointer position to a fraction of the scrub track", () => {
    const track = { left: 50, width: 200 };
    expect(scrubFractionFromPointer(50, track)).toBe(0);
    expect(scrubFractionFromPointer(150, track)).toBe(0.5);
    expect(scrubFractionFromPointer(250, track)).toBe(1);
  });

  it("clamps a drag that overshoots the track", () => {
    const track = { left: 50, width: 200 };
    expect(scrubFractionFromPointer(-100, track)).toBe(0);
    expect(scrubFractionFromPointer(9999, track)).toBe(1);
  });

  it("treats a zero-width track (not yet laid out) as the start", () => {
    expect(scrubFractionFromPointer(500, { left: 0, width: 0 })).toBe(0);
  });

  it("reads a missing manifest as a video that is still being prepared", () => {
    // Posting no longer waits for the encoder, so a clip opened moments after publishing
    // legitimately has no manifest yet. That is not a broken video.
    expect(isVideoNotPublishedYet(404)).toBe(true);
    expect(isVideoNotPublishedYet(403)).toBe(true);
  });

  it("does not excuse a real failure as processing", () => {
    expect(isVideoNotPublishedYet(500)).toBe(false);
    expect(isVideoNotPublishedYet(200)).toBe(false);
    expect(isVideoNotPublishedYet(undefined)).toBe(false);
    expect(isVideoNotPublishedYet(null)).toBe(false);
  });

  it("backs off between checks instead of polling a slow encode hard", () => {
    const first = videoProcessingRetryDelayMs(0);
    const later = videoProcessingRetryDelayMs(3);

    expect(first).toBeLessThanOrEqual(5_000);
    expect(later).toBeGreaterThan(first);
    // Past the end of the ramp it settles rather than growing without bound.
    expect(videoProcessingRetryDelayMs(99)).toBe(videoProcessingRetryDelayMs(5));
  });

  it("reports the manifest status a probe found", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ status: 404 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(probeVideoManifest("https://cdn.example.test/v/playlist.m3u8")).resolves.toBe(404);
    expect(fetchMock).toHaveBeenCalledWith("https://cdn.example.test/v/playlist.m3u8", {
      cache: "no-store",
    });
  });

  it("answers null when the probe itself cannot run", async () => {
    // Offline, or a pull zone that refuses cross-origin reads - unknown, not "processing".
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;

    await expect(probeVideoManifest("https://cdn.example.test/v/playlist.m3u8")).resolves.toBeNull();
  });
});
