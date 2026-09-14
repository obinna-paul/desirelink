import { fireEvent, render, screen } from "@testing-library/react";

import { ProfileCard } from "@/components/home/profile-card";
import type { ProfileCardData } from "@/lib/home-feed";

function profile(overrides: Partial<ProfileCardData> = {}): ProfileCardData {
  return {
    id: "profile-1",
    username: "mara",
    displayName: "Mara Stone",
    avatarUrl: "",
    bannerUrl: "",
    city: "Lagos",
    country: "NG",
    showExactLocation: true,
    profileType: "CREATOR",
    serviceCategories: [],
    isVerified: true,
    isVerifiedCreator: true,
    isVerifiedServiceProvider: false,
    verificationPending: false,
    isTrustedMember: false,
    availabilityStatuses: [{ status: "available_tonight", expiresAt: new Date(Date.now() + 60 * 60 * 1000) }],
    specShownPublicly: false,
    specTestResults: [],
    ...overrides,
  };
}

describe("ProfileCard", () => {
  it("renders profile identity, location, and match score", () => {
    const { container } = render(<ProfileCard profile={profile()} matchScore={91} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/profile/mara");
    expect(screen.getByText("Mara Stone")).toBeInTheDocument();
    expect(screen.getByText("mara")).toBeInTheDocument();
    expect(screen.getByText("Lagos, NG")).toBeInTheDocument();
    expect(screen.getByText("91% match")).toBeInTheDocument();
    expect(container.querySelector('[aria-label="Verified"]')).toBeInTheDocument();
  });

  it("shows a spec badge only when the profile has opted into showing it", () => {
    const { rerender } = render(
      <ProfileCard profile={profile({ specShownPublicly: false, specTestResults: [{ specType: "soft_landing" }] })} />,
    );
    expect(screen.queryByText(/My spec is/)).not.toBeInTheDocument();

    rerender(<ProfileCard profile={profile({ specShownPublicly: true, specTestResults: [{ specType: "soft_landing" }] })} />);
    expect(screen.getByText("My spec is Soft Landing")).toBeInTheDocument();
  });

  it("shows no spec badge when the profile opted in but has no linked result", () => {
    render(<ProfileCard profile={profile({ specShownPublicly: true, specTestResults: [] })} />);
    expect(screen.queryByText(/My spec is/)).not.toBeInTheDocument();
  });

  it("never shows the spec badge when showSpec is false, even if the profile opted in - Discover's own small card", () => {
    render(
      <ProfileCard
        profile={profile({
          specShownPublicly: true,
          specTestResults: [{ specType: "soft_landing" }],
          showExactLocation: true,
        })}
        showSpec={false}
      />,
    );

    expect(screen.queryByText(/My spec is/)).not.toBeInTheDocument();
    // Never displaces location/distance - it's just never shown here at all.
    expect(screen.getByText("Lagos, NG")).toBeInTheDocument();
  });

  it("opens a snapshot popup on badge click instead of navigating the card's own link", () => {
    render(<ProfileCard profile={profile({ specShownPublicly: true, specTestResults: [{ specType: "soft_landing" }] })} matchScore={91} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /My spec is Soft Landing/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Soft Landing" })).toBeInTheDocument();
    expect(screen.getByText(/Affectionate, emotionally available/)).toBeInTheDocument();
    // The card is still a link to the profile - the badge click only opened the popup, it
    // didn't replace or break the card's own navigation.
    expect(screen.getByRole("link")).toHaveAttribute("href", "/profile/mara");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
