import {
  bunnyDirectChunkSizeBytes,
  checkReportedVideoDuration,
  formatMaxVideoUploadSize,
  getBunnyUploadTransportOrder,
  inferVideoContentType,
  isMobileChromeBrowser,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_UPLOAD_BYTES,
  PROCESSING_STALL_TIMEOUT_MS,
  VIDEO_UPLOAD_ACCEPT,
  videoProcessingBudgetMs,
  videoProcessingPollIntervalMs,
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

  it("scales the processing budget with the file instead of one fixed deadline", () => {
    const small = videoProcessingBudgetMs(20 * 1024 * 1024);
    const large = videoProcessingBudgetMs(4 * GIGABYTE);

    expect(small).toBeGreaterThanOrEqual(30 * 60 * 1000);
    expect(small).toBeLessThan(31 * 60 * 1000);
    expect(large).toBeGreaterThan(60 * 60 * 1000);
    // However large the file, a wait that stops moving still ends.
    expect(videoProcessingBudgetMs(500 * GIGABYTE)).toBe(3 * 60 * 60 * 1000);
    expect(PROCESSING_STALL_TIMEOUT_MS).toBe(15 * 60 * 1000);
  });

  it("polls tightly at first, then backs off for a long transcode", () => {
    expect(videoProcessingPollIntervalMs(0)).toBe(2_000);
    expect(videoProcessingPollIntervalMs(5 * 60 * 1000)).toBe(5_000);
    expect(videoProcessingPollIntervalMs(45 * 60 * 1000)).toBe(15_000);
  });

  it("keeps a large upload to a few hundred chunks without enlarging a phone clip's", () => {
    expect(bunnyDirectChunkSizeBytes(40 * 1024 * 1024, true)).toBe(5 * 1024 * 1024);
    expect(bunnyDirectChunkSizeBytes(8 * GIGABYTE, false)).toBe(20 * 1024 * 1024);
    // Mobile keeps smaller chunks: a re-sent chunk costs more on a weak signal.
    expect(bunnyDirectChunkSizeBytes(8 * GIGABYTE, true)).toBe(8 * 1024 * 1024);
    expect(8 * GIGABYTE / bunnyDirectChunkSizeBytes(8 * GIGABYTE, false)).toBeLessThan(500);
  });
});
