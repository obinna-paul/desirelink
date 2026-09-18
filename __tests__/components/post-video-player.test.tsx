import { fireEvent, render, waitFor } from "@testing-library/react";

import { PostVideoPlayer } from "@/components/posts/post-video-player";

class TestIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
}

describe("PostVideoPlayer", () => {
  beforeAll(() => {
    Object.defineProperty(global, "IntersectionObserver", {
      configurable: true,
      value: TestIntersectionObserver,
    });
  });

  it("shows the local upload immediately and falls back to the remote copy if decoding fails", async () => {
    const { container } = render(
      <PostVideoPlayer
        src="blob:local-video"
        fallbackSrc="https://cdn.example.test/video.mp4"
      />,
    );
    const video = container.querySelector("video");

    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("src", "blob:local-video");

    fireEvent.error(video!);

    await waitFor(() => {
      expect(video).toHaveAttribute("src", "https://cdn.example.test/video.mp4");
    });
  });
});
