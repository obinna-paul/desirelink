import { fireEvent, render, screen } from "@testing-library/react";

import { SignOutButton } from "@/components/layout/sign-out-button";

const mockSignOut = jest.fn();

jest.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

describe("SignOutButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("clears the splash-seen flag and signs out, so the next login shows the splash again", () => {
    window.sessionStorage.setItem("udala:splash-seen", "1");

    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(window.sessionStorage.getItem("udala:splash-seen")).toBeNull();
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
