import { render, waitFor } from "@testing-library/react";

const mockLoadSource = jest.fn();
const mockAttachMedia = jest.fn();
const mockDestroy = jest.fn();
const mockStartLoad = jest.fn();
const mockRecoverMediaError = jest.fn();
const mockHandlers: Record<string, (...args: unknown[]) => void> = {};

jest.mock("hls.js", () => {
  class MockHls {
    static isSupported = jest.fn(() => true);
    static Events = {
      MEDIA_ATTACHED: "mediaAttached",
      MANIFEST_PARSED: "manifestParsed",
      ERROR: "error",
    };
    static ErrorTypes = {
      NETWORK_ERROR: "networkError",
      MEDIA_ERROR: "mediaError",
    };

    on(event: string, handler: (...args: unknown[]) => void) {
      mockHandlers[event] = handler;
    }

    attachMedia(media: HTMLMediaElement) {
      mockAttachMedia(media);
      mockHandlers.mediaAttached?.();
    }

    loadSource(src: string) {
      mockLoadSource(src);
    }

    startLoad() {
      mockStartLoad();
    }

    recoverMediaError() {
      mockRecoverMediaError();
    }

    destroy() {
      mockDestroy();
    }
  }

  return { __esModule: true, default: MockHls };
});

import { AdminVideoPlayer } from "@/components/admin/admin-video-player";

describe("AdminVideoPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const event of Object.keys(mockHandlers)) delete mockHandlers[event];
  });

  it("attaches Bunny HLS through hls.js instead of assigning m3u8 to a plain video", async () => {
    const src =
      "https://videos.example.test/cd54b416-fa26-44fe-b794-db1bbb474514/playlist.m3u8";
    const { container } = render(<AdminVideoPlayer src={src} />);

    await waitFor(() => {
      expect(mockAttachMedia).toHaveBeenCalledTimes(1);
      expect(mockLoadSource).toHaveBeenCalledWith(src);
    });

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).not.toHaveAttribute("src", src);
    expect(video).toHaveAttribute("controls");
  });
});
