import { act, fireEvent, render, screen } from "@testing-library/react";

import { AppSplash } from "@/components/splash/app-splash";

describe("AppSplash", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("renders the logo animation as a muted, autoplaying video", () => {
    const { container } = render(<AppSplash />);

    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("autoplay");
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(container.querySelector("source")).toHaveAttribute("src", "/videos/splash-logo.mp4");
  });

  it("dismisses once the video finishes playing", () => {
    const { container } = render(<AppSplash />);
    const video = container.querySelector("video") as HTMLVideoElement;

    act(() => {
      fireEvent(video, new Event("ended"));
      jest.advanceTimersByTime(300);
    });

    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("dismisses on error so a broken video never blocks the app", () => {
    const { container } = render(<AppSplash />);
    const video = container.querySelector("video") as HTMLVideoElement;

    act(() => {
      fireEvent(video, new Event("error"));
      jest.advanceTimersByTime(300);
    });

    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("dismisses when tapped, before the video ends", () => {
    render(<AppSplash />);

    act(() => {
      fireEvent.click(screen.getByRole("presentation"));
      jest.advanceTimersByTime(300);
    });

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });

  it("falls back to dismissing on its own if autoplay never fires ended", () => {
    const { container } = render(<AppSplash />);

    act(() => {
      jest.advanceTimersByTime(9000);
      jest.advanceTimersByTime(300);
    });

    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("does not dismiss before the video ends or the fallback timer fires", () => {
    const { container } = render(<AppSplash />);

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect(container.querySelector("video")).toBeInTheDocument();
  });
});
