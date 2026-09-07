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

  it("renders the logo on a plain white, full-screen background", () => {
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
});
