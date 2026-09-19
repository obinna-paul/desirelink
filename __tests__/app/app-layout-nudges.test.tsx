import { render, screen } from "@testing-library/react";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({ prisma: { profile: { findUnique: jest.fn() } } }));
jest.mock("@/lib/provider-types", () => ({ isProviderProfileType: jest.fn(() => false) }));
jest.mock("@/lib/account-theme", () => ({ getAccountThemeClass: jest.fn(() => "theme-olive") }));
jest.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
jest.mock("@/components/creator/creator-welcome-modal", () => ({
  CreatorWelcomeModal: () => <div data-testid="creator-welcome" />,
}));
jest.mock("@/components/spec-test/spec-test-nudge-modal", () => ({
  SpecTestNudgeModal: () => <div data-testid="spec-nudge" />,
}));
jest.mock("@/components/posts/first-post-nudge-modal", () => ({
  FirstPostNudgeModal: () => <div data-testid="first-post-nudge" />,
}));

import { getServerSession } from "next-auth";

import AppGroupLayout from "@/app/(app)/layout";
import { prisma } from "@/lib/prisma";
import { isProviderProfileType } from "@/lib/provider-types";

const mockSession = getServerSession as jest.Mock;
const mockFindUnique = prisma.profile.findUnique as jest.Mock;
const mockIsProvider = isProviderProfileType as unknown as jest.Mock;

const baseProfile = {
  id: "profile-1",
  profileType: "EXPLORER",
  usernameChosen: true,
  accountTypeChosen: true,
  emailChosen: true,
  gender: "WOMAN",
  username: "ada",
  creatorWelcomeShownAt: new Date(),
  specTestNudgeShownAt: new Date(),
  firstPostNudgeShownAt: null,
  specTestResults: [],
  _count: { posts: 0 },
};

describe("authenticated app nudge ordering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockIsProvider.mockReturnValue(false);
  });

  it("mounts the first-post nudge only for a profile with no posts and no earlier prompt", async () => {
    mockFindUnique.mockResolvedValue(baseProfile);

    render(await AppGroupLayout({ children: <div>App content</div> }));

    expect(screen.getByTestId("first-post-nudge")).toBeInTheDocument();
    expect(screen.queryByTestId("creator-welcome")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spec-nudge")).not.toBeInTheDocument();
  });

  it("does not mount it after any post has been created", async () => {
    mockFindUnique.mockResolvedValue({ ...baseProfile, _count: { posts: 1 } });

    render(await AppGroupLayout({ children: <div>App content</div> }));

    expect(screen.queryByTestId("first-post-nudge")).not.toBeInTheDocument();
  });

  it("gives an unseen Spec Test prompt priority", async () => {
    mockFindUnique.mockResolvedValue({ ...baseProfile, specTestNudgeShownAt: null });

    render(await AppGroupLayout({ children: <div>App content</div> }));

    expect(screen.getByTestId("spec-nudge")).toBeInTheDocument();
    expect(screen.queryByTestId("first-post-nudge")).not.toBeInTheDocument();
  });
});
