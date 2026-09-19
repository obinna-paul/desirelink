import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  FIRST_POST_NUDGE_ENGAGED_DELAY_MS,
  FIRST_POST_NUDGE_FALLBACK_DELAY_MS,
  FIRST_POST_NUDGE_SCROLL_THRESHOLD_PX,
  FirstPostNudgeModal,
} from "@/components/posts/first-post-nudge-modal";

const { __setPathname: setPathname } = jest.requireMock("next/navigation") as {
  __setPathname: (pathname: string) => void;
};

describe("FirstPostNudgeModal", () => {
  function grantedClaim() {
    return {
      ok: true,
      json: async () => ({ show: true }),
    } as Response;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
    setPathname("/");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    setPathname("/");
  });

  it("waits for some active time and meaningful scrolling before revealing", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(grantedClaim());
    const { unmount } = render(<FirstPostNudgeModal profileId="profile-1" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => jest.advanceTimersByTime(FIRST_POST_NUDGE_ENGAGED_DELAY_MS - 1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: FIRST_POST_NUDGE_SCROLL_THRESHOLD_PX,
    });
    fireEvent.scroll(window);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(screen.getByRole("dialog", { name: "Ready for your first post?" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/first-post-nudge-seen", { method: "POST" });

    fireEvent.click(screen.getByRole("button", { name: "Close first post reminder" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    unmount();
    render(<FirstPostNudgeModal profileId="profile-1" />);
    act(() => jest.advanceTimersByTime(FIRST_POST_NUDGE_FALLBACK_DELAY_MS));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a gentle reading-time delay and offers a quieter later action", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(grantedClaim());
    render(<FirstPostNudgeModal profileId="profile-2" />);
    await act(async () => {
      jest.advanceTimersByTime(FIRST_POST_NUDGE_FALLBACK_DELAY_MS);
      await Promise.resolve();
    });

    expect(screen.getByRole("link", { name: /Create my first post/ })).toHaveAttribute("href", "/create");
    fireEvent.click(screen.getByRole("button", { name: "I’ll do it later" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("treats moving to another app page as engagement", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(grantedClaim());
    const { rerender } = render(<FirstPostNudgeModal profileId="profile-route" />);
    act(() => jest.advanceTimersByTime(FIRST_POST_NUDGE_ENGAGED_DELAY_MS));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    setPathname("/discover");
    await act(async () => {
      rerender(<FirstPostNudgeModal profileId="profile-route" />);
      await Promise.resolve();
    });

    expect(screen.getByRole("dialog", { name: "Ready for your first post?" })).toBeInTheDocument();
  });

  it("stays quiet when another tab or device already claimed the prompt", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ show: false }),
    } as Response);
    render(<FirstPostNudgeModal profileId="profile-stale" />);

    await act(async () => {
      jest.advanceTimersByTime(FIRST_POST_NUDGE_FALLBACK_DELAY_MS);
      await Promise.resolve();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not interrupt the create page", () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(grantedClaim());
    setPathname("/create");
    render(<FirstPostNudgeModal profileId="profile-3" />);

    act(() => jest.advanceTimersByTime(FIRST_POST_NUDGE_FALLBACK_DELAY_MS * 2));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
