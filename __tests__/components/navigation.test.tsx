import { fireEvent, render, screen } from "@testing-library/react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";

const navigation = jest.requireMock("next/navigation") as {
  __setPathname: (pathname: string) => void;
};

describe("navigation", () => {
  it("renders primary and secondary sidebar navigation for a provider", () => {
    navigation.__setPathname("/services");
    render(<SidebarNav isProvider />);

    expect(screen.getByRole("complementary", { name: /primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /services/i })).toHaveAttribute("href", "/services");
    expect(screen.getByRole("link", { name: /creator studio/i })).toHaveAttribute("href", "/creator-dashboard");
  });

  it("hides Creator Studio from an explorer's sidebar navigation", () => {
    navigation.__setPathname("/services");
    render(<SidebarNav />);

    expect(screen.getByRole("link", { name: /services/i })).toHaveAttribute("href", "/services");
    expect(screen.queryByRole("link", { name: /creator studio/i })).not.toBeInTheDocument();
  });

  it("renders mobile bottom navigation actions", () => {
    navigation.__setPathname("/messages");
    render(<BottomNav />);

    expect(screen.getByRole("navigation", { name: /primary navigation/i })).toHaveClass(
      "app-bottom-nav",
      "h-[calc(4rem+env(safe-area-inset-bottom))]"
    );
    expect(screen.getByRole("link", { name: /discover/i })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: /create/i })).toHaveAttribute("href", "/create");
    expect(screen.getByRole("link", { name: /messages/i })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: /messages/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /messages/i }).querySelector("svg")).toHaveClass(
      "nav-icon-messages"
    );
    expect(
      screen.getByRole("link", { name: /messages/i }).querySelector(".nav-icon-halo")
    ).toBeInTheDocument();
  });

  it("animates the selected mobile icon and preserves parent state on nested routes", () => {
    navigation.__setPathname("/profile/edit");
    render(<BottomNav />);

    const profile = screen.getByRole("link", { name: /profile/i });
    expect(profile).toHaveAttribute("aria-current", "page");
    expect(profile.querySelector("svg")).toHaveClass("nav-icon-profile");

    const discover = screen.getByRole("link", { name: /discover/i });
    fireEvent.click(discover);
    expect(discover.querySelector("svg")).toHaveClass("nav-icon-discover");
  });
});
