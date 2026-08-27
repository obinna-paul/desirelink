import { render, screen } from "@testing-library/react";

import { ProfileCard } from "@/components/home/profile-card";
import type { ProfileCardData } from "@/lib/home-feed";

function profile(overrides: Partial<ProfileCardData> = {}): ProfileCardData {
  return {
    id: "profile-1",
    username: "mara",
    displayName: "Mara Stone",
    avatarUrl: "",
    city: "Lagos",
    country: "NG",
    showExactLocation: true,
    profileType: "CREATOR",
    serviceCategories: [],
    isVerified: true,
    isVerifiedCreator: true,
    isVerifiedHost: false,
    isTrustedMember: false,
    premiumSubscription: {
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    desires: [
      { id: "desire-1", category: "Dinner" },
      { id: "desire-2", category: "Events" },
      { id: "desire-3", category: "Travel" },
      { id: "desire-4", category: "Music" },
    ],
    availabilityStatuses: [{ status: "available_tonight", expiresAt: new Date(Date.now() + 60 * 60 * 1000) }],
    ...overrides,
  };
}

describe("ProfileCard", () => {
  it("renders profile identity, location, desires, premium badge, and match score", () => {
    render(<ProfileCard profile={profile()} matchScore={91} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/profile/mara");
    expect(screen.getByText("Mara Stone")).toBeInTheDocument();
    expect(screen.getByText("@mara")).toBeInTheDocument();
    expect(screen.getByText("Lagos, NG")).toBeInTheDocument();
    expect(screen.getByText("premium")).toBeInTheDocument();
    expect(screen.getByText("91% match")).toBeInTheDocument();
    expect(screen.getByText("Dinner")).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^creator$/i })).toBeInTheDocument();
  });
});
