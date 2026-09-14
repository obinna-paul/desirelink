import { render, screen } from "@testing-library/react";

jest.mock("@/components/layout/public-header", () => ({ PublicHeader: () => null }));
jest.mock("@/components/layout/public-footer", () => ({ PublicFooter: () => null }));
jest.mock("@/components/spec-test/age-badge", () => ({ AgeBadge: () => null }));
jest.mock("@/components/spec-test/email-capture-form", () => ({ EmailCaptureForm: () => null }));
jest.mock("@/lib/spec-test", () => ({ getSpecTestReading: jest.fn() }));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

import SpecTestResultPage, { generateMetadata } from "@/app/spec-test/result/[id]/page";
import { getSpecTestReading } from "@/lib/spec-test";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import type { SpecTestReading } from "@/lib/spec-test/results";
import { SPEC_TYPE_READINGS } from "@/lib/spec-test/legacy";

const mockGetReading = getSpecTestReading as jest.Mock;
const mockSession = getServerSession as jest.Mock;
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
    gender: "male",
    routingRule: "heterosexual_v0_1",
    assumedAttractionTarget: "female",
    quizForm: "male_user",
    copy: {
      primarySpec: "quiet_fire",
      secondarySpec: "brilliant_tease",
      headline: { name: "Quiet Fire", tagline: "Composed, private, observant and surprisingly intense." },
      secondaryInfluence: "Right behind it: Brilliant Tease - Intelligent, witty and mentally stimulating.",
      corePull: "Core reading paragraph.",
      topMotives: [
        { key: "intrigueSelectiveAccess", label: "Intrigue & Selective Access", copy: "Top motive signal one." },
        { key: "cognitivePlay", label: "Cognitive Play", copy: "Top motive signal two." },
        { key: "warmthResponsiveness", label: "Warmth & Responsiveness", copy: "Top motive signal three." },
      ],
      lensInsight: {
        key: "directnessIntrigue",
        pole: "high",
        title: "Lens insight title.",
        copy: "Lens insight paragraph.",
        partnerNote: "Lens partner note.",
      },
      whatItSaysAboutYou: "What it says about you paragraph.",
      attachmentInsight: { label: "steadyUnderUncertainty", title: "Steady Under Uncertainty", copy: "Attachment insight paragraph." },
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
    mockSession.mockResolvedValue(null);
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

  it("renders the full v2 result structure with the report's disclaimer", async () => {
    mockGetReading.mockResolvedValue(v2Reading());
    const jsx = await SpecTestResultPage({ params: { id: "result-1" } });
    render(jsx);

    expect(screen.getByText("Quiet Fire")).toBeInTheDocument();
    expect(screen.getByText("Composed, private, observant and surprisingly intense.")).toBeInTheDocument();
    expect(screen.getByText("Core reading paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Top motive signal one.")).toBeInTheDocument();
    expect(screen.getByText("Top motive signal two.")).toBeInTheDocument();
    expect(screen.getByText("Top motive signal three.")).toBeInTheDocument();
    expect(screen.getByText("What it says about you paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Something you might not know about yourself")).toBeInTheDocument();
    expect(screen.getByText("Lens insight title.")).toBeInTheDocument();
    expect(screen.getByText("Lens insight paragraph.")).toBeInTheDocument();
    expect(screen.getByText("How you handle uncertainty")).toBeInTheDocument();
    expect(screen.getByText("Steady Under Uncertainty")).toBeInTheDocument();
    expect(screen.getByText("Attachment insight paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Strength paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Blind spot paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Long-term fit paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Lens partner note.")).toBeInTheDocument();
    expect(screen.getByText(/Growth prompt line\./)).toBeInTheDocument();
    expect(screen.getByText("Strong match")).toBeInTheDocument();
    expect(screen.getByText(/not a diagnosis or a prediction of destiny/)).toBeInTheDocument();

    // No dating-loop section when nothing converged, no split twist on a clear result.
    expect(screen.queryByText("Your likely dating loop")).not.toBeInTheDocument();
    expect(screen.queryByText(/Spark answers lean/)).not.toBeInTheDocument();
  });

  it("omits the attachment section when no attachment item was ever answered", async () => {
    mockGetReading.mockResolvedValue(
      v2Reading({ copy: { ...v2Reading().copy, attachmentInsight: null } }),
    );
    const jsx = await SpecTestResultPage({ params: { id: "result-1" } });
    render(jsx);

    expect(screen.queryByText("How you handle uncertainty")).not.toBeInTheDocument();
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
    // report §10: "secondary Spec OR Spark-Partnership split", never both - the twist card
    // shows only one of the two secondary signals, even though the fixture supplies both.
    expect(screen.queryByText(/Right behind it: Brilliant Tease/)).not.toBeInTheDocument();
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

  it("shows a signed-in taker a confirmation and a way back into the app, not the anonymous Join CTA", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } });
    mockGetReading.mockResolvedValue(v2Reading());
    const jsx = await SpecTestResultPage({ params: { id: "result-1" } });
    render(jsx);

    expect(screen.getByText(/Saved to your profile/)).toBeInTheDocument();
    expect(screen.getByText("Back to Udala")).toBeInTheDocument();
    expect(screen.queryByText("Join Udala")).not.toBeInTheDocument();
    expect(screen.queryByText("Want a copy of this in your inbox?")).not.toBeInTheDocument();
  });
});
