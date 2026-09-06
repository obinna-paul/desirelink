import {
  getBunnyUploadTransportOrder,
  inferVideoContentType,
  isMobileChromeBrowser,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_UPLOAD_BYTES,
  VIDEO_UPLOAD_ACCEPT,
} from "@/lib/video-upload-constraints";

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
    expect(MAX_VIDEO_UPLOAD_BYTES).toBe(2 * 1024 * 1024 * 1024);
    expect(MAX_VIDEO_DURATION_SECONDS).toBe(900);
    expect(VIDEO_UPLOAD_ACCEPT).toContain(".mkv");
    expect(VIDEO_UPLOAD_ACCEPT).toContain(".m2ts");
  });
});
