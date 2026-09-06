import { getVideoPosterUrl, isHlsVideoSource } from "@/lib/video-playback";

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
});
