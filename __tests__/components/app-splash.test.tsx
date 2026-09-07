import { act, fireEvent, render, screen } from "@testing-library/react";

import { AppSplash } from "@/components/splash/app-splash";

const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

function setDevice(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
}

describe("AppSplash", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.sessionStorage.clear();
    setDevice(MOBILE_UA);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    window.sessionStorage.clear();
  });

  it("renders the logo on a plain white, full-screen background on a real app open", () => {
    render(<AppSplash />);

    const overlay = screen.getByRole("presentation");
    expect(overlay).toHaveClass("bg-white");
    expect(screen.getByAltText("udala")).toHaveAttribute("src", expect.stringContaining("splash-logo"));
  });

  it("dismisses on its own after ~3 seconds", () => {
    const { container } = render(<AppSplash />);

    act(() => {
      jest.advanceTimersByTime(3000);
      jest.advanceTimersByTime(300);
    });

    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("dismisses when tapped, before the timer elapses", () => {
    render(<AppSplash />);

    act(() => {
      fireEvent.click(screen.getByRole("presentation"));
      jest.advanceTimersByTime(300);
    });

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });

  it("does not dismiss before the display duration elapses", () => {
    const { container } = render(<AppSplash />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(container.querySelector("img")).toBeInTheDocument();
  });

  it("persists that it's been seen once dismissed", () => {
    render(<AppSplash />);

    act(() => {
      jest.advanceTimersByTime(3000);
      jest.advanceTimersByTime(300);
    });

    expect(window.sessionStorage.getItem("udala:splash-seen")).toBe("1");
  });

  it("does not render again within the same browsing context - a page refresh, or resuming from background", () => {
    // sessionStorage survives a reload/remount within the same tab, which is exactly
    // what a refresh or a background-then-resume looks like from the page's own
    // perspective - this is what makes AppSplash skip itself in both cases.
    window.sessionStorage.setItem("udala:splash-seen", "1");

    render(<AppSplash />);

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });

  it("shows again if session storage is unavailable, but never throws", () => {
    const realSessionStorage = window.sessionStorage;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("storage disabled");
        },
        setItem: () => {
          throw new Error("storage disabled");
        },
      },
    });

    try {
      expect(() => render(<AppSplash />)).not.toThrow();
      expect(screen.getByRole("presentation")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "sessionStorage", { configurable: true, value: realSessionStorage });
    }
  });

  it("never renders on a desktop/laptop browser - it's a mobile-app-style greeting only", () => {
    setDevice(DESKTOP_UA);

    render(<AppSplash />);

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("udala:splash-seen")).toBeNull();
  });
});
