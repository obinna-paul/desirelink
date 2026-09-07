import { act, fireEvent, render, screen } from "@testing-library/react";

import { AppSplash } from "@/components/splash/app-splash";

describe("AppSplash", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    window.localStorage.clear();
  });

  it("renders the logo on a plain white, full-screen background on a first-ever visit", () => {
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

    expect(window.localStorage.getItem("udala:splash-seen")).toBe("1");
  });

  it("never renders again on a later mount (a page refresh or reopening the app)", () => {
    window.localStorage.setItem("udala:splash-seen", "1");

    render(<AppSplash />);

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });

  it("shows again if local storage is unavailable, but never throws", () => {
    const realLocalStorage = window.localStorage;
    Object.defineProperty(window, "localStorage", {
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
      Object.defineProperty(window, "localStorage", { configurable: true, value: realLocalStorage });
    }
  });
});
