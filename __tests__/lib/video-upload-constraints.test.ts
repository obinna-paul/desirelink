import {
  bunnyChunkStallTimeoutMs,
  bunnyDirectChunkSizeBytes,
  checkReportedVideoDuration,
  formatMaxVideoUploadSize,
  formatVideoDuration,
  getBunnyUploadTransportOrder,
  inferVideoContentType,
  isMobileChromeBrowser,
  MAX_PREMIUM_VIDEO_DURATION_SECONDS,
  MAX_PREMIUM_VIDEO_UPLOAD_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_UPLOAD_BYTES,
  maxVideoDurationSecondsFor,
  maxVideoUploadBytesFor,
  VIDEO_UPLOAD_ACCEPT,
} from "@/lib/video-upload-constraints";

const GIGABYTE = 1024 * 1024 * 1024;

describe("video upload constraints", () => {
  const androidChrome =
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
  const androidFirefox =
    "Mozilla/5.0 (Android 15; Mobile; rv:142.0) Gecko/142.0 Firefox/142.0";
  const operaMini =
    "Opera/9.80 (Android; Opera Mini/85.0.2254/191.321; U; en) Presto/2.12.423";
  const desktopChrome =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

  it("uses Bunny direct upload first only for mobile Chrome", () => {
    expect(isMobileChromeBrowser(androidChrome)).toBe(true);
    expect(getBunnyUploadTransportOrder(androidChrome, true)).toEqual(["direct", "relay"]);
    expect(getBunnyUploadTransportOrder(androidFirefox, true)).toEqual(["relay", "direct"]);
    expect(getBunnyUploadTransportOrder(operaMini, true)).toEqual(["relay", "direct"]);
    expect(getBunnyUploadTransportOrder(desktopChrome, false)).toEqual(["direct", "relay"]);
  });

  it("sends a big file direct even on a relay-first browser", () => {
    // The relay's ~3MB chunks would mean thousands of round trips; direct stays the
    // fallback either way, so nothing loses its escape hatch.
    expect(getBunnyUploadTransportOrder(androidFirefox, true, 40 * 1024 * 1024)).toEqual([
      "relay",
      "direct",
    ]);
    expect(getBunnyUploadTransportOrder(androidFirefox, true, 3 * GIGABYTE)).toEqual([
      "direct",
      "relay",
    ]);
  });

  it("gives premium posts the long-form ceilings and keeps the feed's", () => {
    expect(MAX_VIDEO_DURATION_SECONDS).toBe(15 * 60);
    expect(MAX_PREMIUM_VIDEO_DURATION_SECONDS).toBe(4 * 60 * 60);
    expect(maxVideoDurationSecondsFor(false)).toBe(MAX_VIDEO_DURATION_SECONDS);
    expect(maxVideoDurationSecondsFor(true)).toBe(MAX_PREMIUM_VIDEO_DURATION_SECONDS);
    expect(maxVideoUploadBytesFor(false)).toBe(MAX_VIDEO_UPLOAD_BYTES);
    expect(maxVideoUploadBytesFor(true)).toBe(MAX_PREMIUM_VIDEO_UPLOAD_BYTES);
    // A four-hour upload has to fit its own ceiling at a real long-form bitrate.
    expect(MAX_PREMIUM_VIDEO_UPLOAD_BYTES).toBeGreaterThan(MAX_VIDEO_UPLOAD_BYTES);
  });

  it("names a limit the way a person would say it", () => {
    expect(formatVideoDuration(MAX_VIDEO_DURATION_SECONDS)).toBe("15 minutes");
    expect(formatVideoDuration(MAX_PREMIUM_VIDEO_DURATION_SECONDS)).toBe("4 hours");
    expect(formatVideoDuration(60 * 60)).toBe("1 hour");
    expect(formatVideoDuration(90 * 60)).toBe("1 hour 30 minutes");
  });

  it("normalizes Android's generic MIME type from a supported filename", () => {
    expect(inferVideoContentType("VID_20260906_120000.MP4", "application/octet-stream")).toBe(
      "video/mp4",
    );
    expect(inferVideoContentType("camera.m2ts", "")).toBe("video/mp2t");
    expect(inferVideoContentType("clip.mov", "video/quicktime; codecs=hevc")).toBe(
      "video/quicktime",
    );
    expect(inferVideoContentType("document.pdf", "application/pdf")).toBeNull();
  });

  it("publishes one shared size, duration, and picker contract", () => {
    // Has to clear a full-length 4K60 phone export (~600MB/minute), or the composer
    // rejects it at selection however patient the creator is.
    expect(MAX_VIDEO_UPLOAD_BYTES).toBeGreaterThanOrEqual(9 * GIGABYTE);
    expect(formatMaxVideoUploadSize()).toBe("12GB");
    expect(MAX_VIDEO_DURATION_SECONDS).toBe(900);
    expect(VIDEO_UPLOAD_ACCEPT).toContain(".mkv");
    expect(VIDEO_UPLOAD_ACCEPT).toContain(".m2ts");
  });

  it("measures a premium video against the premium ceiling", () => {
    const hourLong = 62 * 60;
    expect(checkReportedVideoDuration(hourLong).withinLimit).toBe(false);
    expect(
      checkReportedVideoDuration(hourLong, MAX_PREMIUM_VIDEO_DURATION_SECONDS),
    ).toEqual({ withinLimit: true, durationSeconds: hourLong });
    expect(
      checkReportedVideoDuration(5 * 60 * 60, MAX_PREMIUM_VIDEO_DURATION_SECONDS).withinLimit,
    ).toBe(false);
  });

  it("forgives the sub-second disagreement between a browser and a transcoder", () => {
    expect(checkReportedVideoDuration(899.7)).toEqual({
      withinLimit: true,
      durationSeconds: 899.7,
    });
    // Accepted, but recorded at the cap so the post payload still validates.
    expect(checkReportedVideoDuration(902)).toEqual({
      withinLimit: true,
      durationSeconds: MAX_VIDEO_DURATION_SECONDS,
    });
    expect(checkReportedVideoDuration(940).withinLimit).toBe(false);
    expect(checkReportedVideoDuration(undefined)).toEqual({
      withinLimit: true,
      durationSeconds: undefined,
    });
  });

  it("keeps a large upload to a few hundred chunks without enlarging a phone clip's", () => {
    expect(bunnyDirectChunkSizeBytes(40 * 1024 * 1024, true)).toBe(5 * 1024 * 1024);
    expect(bunnyDirectChunkSizeBytes(8 * GIGABYTE, false)).toBe(20 * 1024 * 1024);
    // Mobile keeps smaller chunks: a re-sent chunk costs more on a weak signal.
    expect(bunnyDirectChunkSizeBytes(8 * GIGABYTE, true)).toBe(8 * 1024 * 1024);
    expect(8 * GIGABYTE / bunnyDirectChunkSizeBytes(8 * GIGABYTE, false)).toBeLessThan(500);
  });

  it("does not mistake a slow large chunk for a stalled request", () => {
    expect(bunnyChunkStallTimeoutMs(3 * 1024 * 1024)).toBeGreaterThan(2 * 60 * 1000);
    expect(bunnyChunkStallTimeoutMs(20 * 1024 * 1024)).toBeGreaterThan(10 * 60 * 1000);
    expect(bunnyChunkStallTimeoutMs(100 * 1024 * 1024)).toBe(15 * 60 * 1000);
  });
});
