import { render, screen } from "@testing-library/react";

jest.mock("@/components/layout/public-header", () => ({ PublicHeader: () => null }));
jest.mock("@/components/layout/public-footer", () => ({ PublicFooter: () => null }));
jest.mock("@/components/spec-test/age-badge", () => ({ AgeBadge: () => null }));
jest.mock("@/components/spec-test/email-capture-form", () => ({ EmailCaptureForm: () => null }));
jest.mock("@/lib/spec-test", () => ({ getSpecTestReading: jest.fn() }));

import SpecTestResultPage, { generateMetadata } from "@/app/spec-test/result/[id]/page";
import { getSpecTestReading } from "@/lib/spec-test";
import { notFound } from "next/navigation";
import type { SpecTestReading } from "@/lib/spec-test/results";
import { SPEC_TYPE_READINGS } from "@/lib/spec-test/legacy";

const mockGetReading = getSpecTestReading as jest.Mock;
const mockNotFound = notFound as unknown as jest.Mock;

function v2Reading(overrides: Partial<Extract<SpecTestReading, { version: "v2" }>> = {}): Extract<SpecTestReading, { version: "v2" }> {
  return {
    version: "v2",
    id: "result-1",
    instrumentVersion: "spec-v2.0",
    primarySpec: "quiet_fire",
    secondarySpec: "brilliant_tease",
    confidence: "clear",
    motiveScores: {
      warmthResponsiveness: 40,
      reliabilityReciprocity: 50,
      socialVitality: 30,
      agencyDirection: 40,
      cognitivePlay: 60,
      noveltyAutonomy: 35,
      intrigueSelectiveAccess: 78,
    },
    motiveFacets: { containedDepthPrivacy: 82, aestheticSelectivity: 55 },
    lenses: {
      sparkSafety: 40,
      closenessAutonomy: 45,
      fastSlow: 40,
      directnessIntrigue: 60,
      privatePublic: 40,
      admirationMutuality: 45,
      mindEmbodied: 55,
      explorationCommitment: 40,
    },
    attachment: { anxiety: 40, avoidance: 40, label: "steadyUnderUncertainty" },
    sparkSpec: "quiet_fire",
    partnershipSpec: "quiet_fire",
    patternFlags: [],
    copy: {
      primarySpec: "quiet_fire",
      secondarySpec: "brilliant_tease",
      headline: { name: "Quiet Fire", tagline: "Composed, private, observant and surprisingly intense." },
      secondaryInfluence: "Right behind it: Brilliant Tease - Intelligent, witty and mentally stimulating.",
      corePull: "Core reading paragraph.",
      whatItSaysAboutYou: "What it says about you paragraph.",
      datingLoop: [],
      strength: "Strength paragraph.",
      blindSpot: "Blind spot paragraph.",
      longTermFit: "Long-term fit paragraph.",
      growthPrompt: "Growth prompt line.",
      confidence: "clear",
      confidenceLabel: "Strong match",
      sparkPartnershipTwist: null,
    },
    ...overrides,
  };
}

describe("Spec Test result page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls notFound for a missing result", async () => {
    mockGetReading.mockResolvedValue(null);
    // Mirrors real next/navigation behavior (notFound() throws to halt rendering) - the
    // global test mock is a no-op, so without this the component would keep running past it.
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    await expect(SpecTestResultPage({ params: { id: "missing" } })).rejects.toThrow();
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders the v2 ten-section structure with the report's disclaimer", async () => {
    mockGetReading.mockResolvedValue(v2Reading());
    const jsx = await SpecTestResultPage({ params: { id: "result-1" } });
    render(jsx);

    expect(screen.getByText("Quiet Fire")).toBeInTheDocument();
    expect(screen.getByText("Composed, private, observant and surprisingly intense.")).toBeInTheDocument();
    expect(screen.getByText("Core reading paragraph.")).toBeInTheDocument();
    expect(screen.getByText("What it says about you paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Strength paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Blind spot paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Long-term fit paragraph.")).toBeInTheDocument();
    expect(screen.getByText(/Growth prompt line\./)).toBeInTheDocument();
    expect(screen.getByText("Strong match")).toBeInTheDocument();
    expect(screen.getByText(/not a diagnosis or a prediction of destiny/)).toBeInTheDocument();

    // No dating-loop section when nothing converged, no split twist on a clear result.
    expect(screen.queryByText("Your likely dating loop")).not.toBeInTheDocument();
    expect(screen.queryByText(/Spark answers lean/)).not.toBeInTheDocument();
  });

  it("renders the dating-loop module only when a pattern flag actually converged", async () => {
    mockGetReading.mockResolvedValue(
      v2Reading({
        copy: {
          ...v2Reading().copy,
          datingLoop: [{ id: "ambiguity_amplification", copy: "Hot-and-cold attention may have occupied more mental space than steady interest." }],
        },
      }),
    );
    const jsx = await SpecTestResultPage({ params: { id: "result-1" } });
    render(jsx);

    expect(screen.getByText("Your likely dating loop")).toBeInTheDocument();
    expect(screen.getByText(/Hot-and-cold attention/)).toBeInTheDocument();
  });

  it("renders the spark/partnership twist only on a split result", async () => {
    mockGetReading.mockResolvedValue(
      v2Reading({
        confidence: "split",
        copy: {
          ...v2Reading().copy,
          confidence: "split",
          confidenceLabel: "Your spark and your staying power point in different places",
          sparkPartnershipTwist: {
            sparkSpec: "electric_charmer",
            sparkName: "Electric Charmer",
            partnershipSpec: "grounded_equal",
            partnershipName: "Grounded Equal",
            copy: "Your Spark answers lean Electric Charmer; your Partnership answers lean Grounded Equal.",
          },
        },
      }),
    );
    const jsx = await SpecTestResultPage({ params: { id: "result-1" } });
    render(jsx);

    expect(screen.getByText(/Spark answers lean Electric Charmer/)).toBeInTheDocument();
  });

  it("renders the original v1 reading with a CTA to take the new version", async () => {
    mockGetReading.mockResolvedValue({
      version: "v1",
      id: "legacy-1",
      specType: "grounded_equal",
      reading: SPEC_TYPE_READINGS.grounded_equal,
    });
    const jsx = await SpecTestResultPage({ params: { id: "legacy-1" } });
    render(jsx);

    expect(screen.getByText(SPEC_TYPE_READINGS.grounded_equal.name)).toBeInTheDocument();
    expect(screen.getByText(SPEC_TYPE_READINGS.grounded_equal.tagline)).toBeInTheDocument();
    expect(screen.getByText("Take the new one")).toBeInTheDocument();
    // v1 rows never show the v2-only disclaimer/confidence copy.
    expect(screen.queryByText("Strong match")).not.toBeInTheDocument();
  });

  it("builds metadata from the composed v2 headline", async () => {
    mockGetReading.mockResolvedValue(v2Reading());
    const metadata = await generateMetadata({ params: { id: "result-1" } });
    expect(metadata.title).toBe("My spec is Quiet Fire | The Spec Test");
    expect(metadata.description).toBe("Composed, private, observant and surprisingly intense.");
  });
});
