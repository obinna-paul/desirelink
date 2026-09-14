import { render, screen } from "@testing-library/react";

jest.mock("@/components/layout/public-header", () => ({ PublicHeader: () => null }));
jest.mock("@/components/layout/public-footer", () => ({ PublicFooter: () => null }));
jest.mock("@/components/spec-test/age-badge", () => ({ AgeBadge: () => null }));
jest.mock("@/components/spec-test/quiz-flow", () => ({ SpecTestQuizFlow: () => <div data-testid="quiz-flow" /> }));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findUnique: jest.fn() },
    specTestResult: { findFirst: jest.fn() },
  },
}));

import SpecTestQuizPage, { metadata } from "@/app/spec-test/quiz/page";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const mockSession = getServerSession as jest.Mock;
const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock };
  specTestResult: { findFirst: jest.Mock };
};

describe("Spec Test quiz page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps the page title bare, letting the root layout's template append the site name once", () => {
    // The root layout's metadata template is "%s | Udala" - if this title already included
    // "| Udala" itself, the rendered title would double up to "The Spec Test | Udala | Udala".
    expect(metadata.title).toBe("The Spec Test");
  });

  it("renders the quiz straight away for an anonymous visitor", async () => {
    mockSession.mockResolvedValue(null);

    const jsx = await SpecTestQuizPage();
    render(jsx);

    expect(screen.getByTestId("quiz-flow")).toBeInTheDocument();
    // Never queries for a cooldown at all when there's no session to check it against.
    expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled();
  });

  it("renders the quiz for a signed-in taker with no prior result", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1" });
    mockPrisma.specTestResult.findFirst.mockResolvedValue(null);

    const jsx = await SpecTestQuizPage();
    render(jsx);

    expect(screen.getByTestId("quiz-flow")).toBeInTheDocument();
  });

  it("renders the quiz once a prior result's 30-day cooldown has elapsed", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1" });
    mockPrisma.specTestResult.findFirst.mockResolvedValue({
      id: "old-result",
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });

    const jsx = await SpecTestQuizPage();
    render(jsx);

    expect(screen.getByTestId("quiz-flow")).toBeInTheDocument();
  });

  it("shows the existing result up front for a signed-in taker inside the cooldown, instead of the 24-question quiz", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-1" });
    mockPrisma.specTestResult.findFirst.mockResolvedValue({
      id: "recent-result",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    const jsx = await SpecTestQuizPage();
    render(jsx);

    expect(screen.queryByTestId("quiz-flow")).not.toBeInTheDocument();
    expect(screen.getByText(/already got a recent spec/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /View your result/ });
    expect(link).toHaveAttribute("href", "/spec-test/result/recent-result");
  });
});
