import { act, fireEvent, render, screen, within } from "@testing-library/react";
import useSWR from "swr";

import {
  ProfileSetupActions,
  type SetupProfile,
} from "@/components/profile/profile-setup-actions";

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseSWR = useSWR as jest.Mock;

const incompleteProfile: SetupProfile = {
  avatarUrl: "",
  bio: "",
  city: "",
  country: "",
  openToChat: false,
  openToMeet: false,
  showInSearch: false,
  showExactLocation: true,
  isVerified: false,
  isVerifiedCreator: false,
  isVerifiedServiceProvider: false,
};

describe("ProfileSetupActions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.sessionStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
    mockUseSWR.mockReturnValue({ data: { profile: incompleteProfile } });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("shows only the first three pending actions while progress uses the full checklist", () => {
    render(<ProfileSetupActions profile={incompleteProfile} />);
    const panel = screen.getByText("Quick actions").closest("section");

    expect(panel).not.toBeNull();
    expect(within(panel!).getAllByRole("link")).toHaveLength(3);
    expect(within(panel!).getByText("Add profile photo")).toBeInTheDocument();
    expect(within(panel!).getByText("Write your bio")).toBeInTheDocument();
    expect(within(panel!).getByText("Add your city")).toBeInTheDocument();
    expect(within(panel!).queryByText("Add your country")).not.toBeInTheDocument();
    expect(within(panel!).getByText("0/9")).toBeInTheDocument();
  });

  it("animates a completed action after navigation and fills its queue slot", async () => {
    const firstRender = render(<ProfileSetupActions profile={incompleteProfile} />);
    const photoAction = screen.getByRole("link", { name: /Add profile photo/i });
    photoAction.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(photoAction);
    firstRender.unmount();

    const completedProfile = { ...incompleteProfile, avatarUrl: "https://images.example/avatar.jpg" };
    mockUseSWR.mockReturnValue({ data: { profile: completedProfile } });
    render(<ProfileSetupActions profile={completedProfile} />);

    expect(screen.getByText("1/9")).toBeInTheDocument();
    expect(screen.getByText("Add profile photo")).toBeInTheDocument();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });

    const panel = screen.getByText("Quick actions").closest("section");
    expect(within(panel!).queryByText("Add profile photo")).not.toBeInTheDocument();
    expect(within(panel!).getByText("Add your country")).toBeInTheDocument();
    expect(within(panel!).getAllByRole("link")).toHaveLength(3);
  });
});
