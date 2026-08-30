import { render, screen } from "@testing-library/react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";

const navigation = jest.requireMock("next/navigation") as {
  __setPathname: (pathname: string) => void;
};

describe("navigation", () => {
  it("renders primary and secondary sidebar navigation for a provider", () => {
    navigation.__setPathname("/events");
    render(<SidebarNav isProvider />);

    expect(screen.getByRole("complementary", { name: /primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /events/i })).toHaveAttribute("href", "/events");
    expect(screen.getByRole("link", { name: /creator studio/i })).toHaveAttribute("href", "/creator-dashboard");
  });

  it("hides Creator Studio from an explorer's sidebar navigation", () => {
    navigation.__setPathname("/events");
    render(<SidebarNav />);

    expect(screen.getByRole("link", { name: /events/i })).toHaveAttribute("href", "/events");
    expect(screen.queryByRole("link", { name: /creator studio/i })).not.toBeInTheDocument();
  });

  it("renders mobile bottom navigation actions", () => {
    navigation.__setPathname("/messages");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /discover/i })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: /create/i })).toHaveAttribute("href", "/create");
    expect(screen.getByRole("link", { name: /messages/i })).toHaveAttribute("href", "/messages");
  });
});

