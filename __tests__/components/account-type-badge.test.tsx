import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AccountTypeBadge } from "@/components/profile/account-type-badge";

describe("AccountTypeBadge", () => {
  it("labels a Creator profile accessibly", () => {
    render(<AccountTypeBadge profileType="CREATOR" />);

    expect(screen.getByRole("button", { name: "Creator account" })).toBeInTheDocument();
  });

  it("labels an Explorer profile accessibly", () => {
    render(<AccountTypeBadge profileType="EXPLORER" />);

    expect(screen.getByRole("button", { name: "Explorer account" })).toBeInTheDocument();
  });

  it("labels a Seeker profile accessibly", () => {
    render(<AccountTypeBadge profileType="SEEKER" />);

    expect(screen.getByRole("button", { name: "Seeker account" })).toBeInTheDocument();
  });

  it("reveals the label on tap and hides it again on a second tap", async () => {
    const user = userEvent.setup();
    render(<AccountTypeBadge profileType="SEEKER" />);

    expect(screen.queryByText("Seeker")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seeker account" }));
    expect(screen.getByText("Seeker")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seeker account" }));
    expect(screen.queryByText("Seeker")).not.toBeInTheDocument();
  });

  it("switches icon and label when the profile type changes", () => {
    const { rerender } = render(<AccountTypeBadge profileType="EXPLORER" />);
    expect(screen.getByRole("button", { name: "Explorer account" })).toBeInTheDocument();

    rerender(<AccountTypeBadge profileType="CREATOR" />);
    expect(screen.queryByRole("button", { name: "Explorer account" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Creator account" })).toBeInTheDocument();
  });
});
