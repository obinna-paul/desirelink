import { render, screen } from "@testing-library/react";

import {
  getPresenceDestination,
  PresenceRing,
} from "@/components/ui/presence-avatar";

describe("presence avatars", () => {
  it("adds a broadcast-wave indicator for live profiles", () => {
    const { container } = render(
      <PresenceRing status="live">
        <span>Avatar</span>
      </PresenceRing>,
    );

    expect(screen.getByText("Live now")).toHaveClass("sr-only");
    expect(container.querySelector('[data-presence-indicator="live"]')).toBeInTheDocument();
    expect(container.querySelector('[data-presence-indicator="online"]')).not.toBeInTheDocument();
  });

  it("adds a green status dot for online profiles", () => {
    const { container } = render(
      <PresenceRing status="online">
        <span>Avatar</span>
      </PresenceRing>,
    );

    expect(screen.getByText("Online")).toHaveClass("sr-only");
    expect(container.querySelector('[data-presence-indicator="online"]')).toHaveClass(
      "bg-presence-online",
    );
    expect(container.querySelector('[data-presence-indicator="live"]')).not.toBeInTheDocument();
  });

  it("routes a live profile directly into its active stream", () => {
    expect(
      getPresenceDestination({
        username: "amara",
        status: "live",
        activeStreamId: "stream-123",
      }),
    ).toBe("/live/stream-123");

    expect(
      getPresenceDestination({
        username: "amara",
        status: "online",
        activeStreamId: null,
      }),
    ).toBe("/profile/amara");
  });
});
