import { render, screen } from "@testing-library/react";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/admin/access", () => ({ requireCapability: jest.fn() }));
jest.mock("@/lib/spec-test", () => ({
  getSpecTestLeads: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
  getSpecTestProfileResults: jest.fn(),
  getSpecTestTypeDistribution: jest.fn().mockResolvedValue([]),
  getSpecTestConfidenceMix: jest.fn().mockResolvedValue({
    clear: 0,
    blend: 0,
    split: 0,
    lowSignal: 0,
    totalAttempts: 0,
    rates: { clear: 0, blend: 0, split: 0, low_signal: 0 },
  }),
  getSpecTestConfidenceMixByForm: jest.fn().mockResolvedValue([]),
  getSpecTestTypeDistributionByForm: jest.fn().mockResolvedValue([]),
  getSpecTestItemAnalytics: jest.fn().mockResolvedValue([]),
  getSpecTestDataSplitCounts: jest.fn().mockResolvedValue({ development: 0, holdout: 0 }),
  SPEC_TYPE_READINGS: { grounded_equal: { name: "The Grounded Equal" } },
  INSTRUMENT_VERSION: "spec-v2.1",
}));

import AdminSpecTestLeadsPage from "@/app/(admin)/admin/spec-test/page";
import { getServerSession } from "next-auth";
import { requireCapability } from "@/lib/admin/access";
import { getSpecTestProfileResults } from "@/lib/spec-test";

const mockSession = getServerSession as jest.Mock;
const mockRequireCapability = requireCapability as jest.Mock;
const mockGetProfileResults = getSpecTestProfileResults as jest.Mock;

describe("Admin Spec Test page - members who've taken the test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "admin-1" } });
    mockRequireCapability.mockResolvedValue({ ok: true, role: "SUPERADMIN" });
  });

  it("lists a registered member's spec even though they never gave an email (unlike the Leads list)", async () => {
    mockGetProfileResults.mockResolvedValue({
      items: [
        {
          id: "result-1",
          specType: "grounded_equal",
          secondarySpec: null,
          resultConfidence: "clear",
          gender: "male",
          instrumentVersion: "spec-v2.1",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          profile: { id: "profile-1", username: "mara", displayName: "Mara Stone", avatarUrl: "" },
        },
      ],
      nextCursor: null,
    });

    const jsx = await AdminSpecTestLeadsPage({ searchParams: {} });
    render(jsx);

    expect(screen.getByText("Members who’ve taken the test")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "@mara" })).toHaveAttribute("href", "/profile/mara");
    expect(screen.getByText("The Grounded Equal")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
    expect(screen.getByText("Man")).toBeInTheDocument();
  });

  it("shows an empty state when no registered member has taken the test yet", async () => {
    mockGetProfileResults.mockResolvedValue({ items: [], nextCursor: null });

    const jsx = await AdminSpecTestLeadsPage({ searchParams: {} });
    render(jsx);

    expect(screen.getByText("No registered member has taken the test yet.")).toBeInTheDocument();
  });

  it("links pagination through a separate cursor param from the Leads list", async () => {
    mockGetProfileResults.mockResolvedValue({
      items: [
        {
          id: "result-1",
          specType: "grounded_equal",
          secondarySpec: null,
          resultConfidence: "clear",
          gender: "male",
          instrumentVersion: "spec-v2.1",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          profile: { id: "profile-1", username: "mara", displayName: "Mara Stone", avatarUrl: "" },
        },
      ],
      nextCursor: "result-2",
    });

    const jsx = await AdminSpecTestLeadsPage({ searchParams: {} });
    render(jsx);

    const loadMoreLinks = screen.getAllByRole("link", { name: "Load more" });
    expect(loadMoreLinks.some((link) => link.getAttribute("href") === "/admin/spec-test?resultsCursor=result-2")).toBe(true);
  });
});
