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
  getSpecTestPilotAnalytics: jest.fn().mockResolvedValue({
    instrumentVersion: "spec-v3-pilot.1",
    startedAttempts: 0,
    completedSubmissions: 0,
    completionRate: 0,
    dataSplit: { development: 0, holdout: 0 },
    qualityClean: { total: 0, development: 0, holdout: 0 },
    qualityFlaggedSubmissions: 0,
    qualityFlagCounts: {},
    funnel: [],
    motives: [],
    items: [],
  }),
  reviewSpecTestPilot: jest.fn().mockReturnValue({
    status: "collecting",
    gates: [],
    warnings: [],
  }),
  SPEC_TYPE_READINGS: { grounded_equal: { name: "The Grounded Equal" } },
  INSTRUMENT_VERSION: "spec-v2.1",
  V3_INSTRUMENT_VERSION: "spec-v3.0",
}));

import AdminSpecTestLeadsPage from "@/app/(admin)/admin/spec-test/page";
import { getServerSession } from "next-auth";
import { requireCapability } from "@/lib/admin/access";
import {
  getSpecTestItemAnalytics,
  getSpecTestProfileResults,
  getSpecTestTypeDistribution,
  getSpecTestTypeDistributionByForm,
  getSpecTestPilotAnalytics,
} from "@/lib/spec-test";

const mockSession = getServerSession as jest.Mock;
const mockRequireCapability = requireCapability as jest.Mock;
const mockGetProfileResults = getSpecTestProfileResults as jest.Mock;
const mockGetTypeDistribution = getSpecTestTypeDistribution as jest.Mock;
const mockGetTypeDistributionByForm = getSpecTestTypeDistributionByForm as jest.Mock;
const mockGetItemAnalytics = getSpecTestItemAnalytics as jest.Mock;
const mockGetPilotAnalytics = getSpecTestPilotAnalytics as jest.Mock;

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

  it("requests every type distribution for the current instrument version", async () => {
    mockGetProfileResults.mockResolvedValue({ items: [], nextCursor: null });

    await AdminSpecTestLeadsPage({ searchParams: {} });

    expect(mockGetTypeDistribution).toHaveBeenCalledWith("spec-v3.0");
    expect(mockGetTypeDistributionByForm).toHaveBeenCalledWith("spec-v3.0");
  });

  it("shows option wording and choice rates in item analytics", async () => {
    mockGetProfileResults.mockResolvedValue({ items: [], nextCursor: null });
    mockGetItemAnalytics.mockResolvedValue([
      {
        itemId: "crowded-event",
        answeredCount: 10,
        skippedCount: 0,
        skipRate: 0,
        medianElapsedMs: 3200,
        positionCounts: [2, 3, 2, 3],
        options: [
          { optionId: "crowded-event-a", label: "The quiet {person} in the corner.", chosenCount: 6, choiceRate: 0.6 },
          { optionId: "crowded-event-b", label: "The lively {person} in the room.", chosenCount: 2, choiceRate: 0.2 },
          { optionId: "crowded-event-c", label: "The focused {person} in charge.", chosenCount: 1, choiceRate: 0.1 },
          { optionId: "crowded-event-d", label: "The polished {person} leaving early.", chosenCount: 1, choiceRate: 0.1 },
        ],
      },
    ]);

    const jsx = await AdminSpecTestLeadsPage({ searchParams: {} });
    render(jsx);

    expect(screen.getByText("The quiet person in the corner.")).toBeInTheDocument();
    expect(screen.getByText("6 · 60%")).toBeInTheDocument();
  });

  it("shows the isolated v3 pilot funnel and hold-out monitoring", async () => {
    mockGetProfileResults.mockResolvedValue({ items: [], nextCursor: null });
    mockGetPilotAnalytics.mockResolvedValue({
      instrumentVersion: "spec-v3-pilot.1",
      startedAttempts: 10,
      completedSubmissions: 6,
      completionRate: 0.6,
      dataSplit: { development: 5, holdout: 1 },
      qualityClean: { total: 4, development: 3, holdout: 1 },
      qualityFlaggedSubmissions: 2,
      qualityFlagCounts: { too_fast: 2 },
      funnel: [
        { completedCount: 0, label: "Consented / started", attemptsReached: 10, reachRate: 1 },
        { completedCount: 28, label: "Submitted all questions", attemptsReached: 6, reachRate: 0.6 },
      ],
      motives: [
        {
          dimension: "warmthResponsiveness",
          label: "Warmth & Responsiveness",
          count: 6,
          mean: 0.2,
          standardDeviation: 0.1,
          minimum: 0,
          maximum: 0.4,
          developmentMean: 0.18,
          holdoutMean: 0.3,
        },
      ],
      items: [],
    });

    const jsx = await AdminSpecTestLeadsPage({ searchParams: {} });
    render(jsx);

    expect(screen.getByText("v3 research pilot")).toBeInTheDocument();
    expect(screen.getAllByText("60%")).toHaveLength(2);
    expect(screen.getByText("Warmth & Responsiveness")).toBeInTheDocument();
    expect(screen.getByText("too_fast: 2")).toBeInTheDocument();
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
