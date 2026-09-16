import {
  formatPlaybackTime,
  getVideoPosterUrl,
  getVideoTapZone,
  isHlsVideoSource,
  scrubFractionFromPointer,
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
});
