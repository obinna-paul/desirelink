jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));
jest.mock("@/components/emails/spec-test-result", () => ({ SpecTestResultEmail: jest.fn(() => null) }));

import { sendSpecTestResultEmail } from "@/lib/email/spec-test-notifications";
import { sendEmail } from "@/lib/email/send";
import { SpecTestResultEmail } from "@/components/emails/spec-test-result";
import { SPEC_TYPE_READINGS } from "@/lib/spec-test/legacy";
import type { SpecTestReading } from "@/lib/spec-test/results";

const mockSendEmail = sendEmail as jest.Mock;
const mockEmailComponent = SpecTestResultEmail as jest.Mock;

describe("sendSpecTestResultEmail", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends the v1 reading's own name/tagline/intro, with no secondary line", async () => {
    const reading: SpecTestReading = {
      version: "v1",
      id: "legacy-1",
      specType: "grounded_equal",
      reading: SPEC_TYPE_READINGS.grounded_equal,
    };

    await sendSpecTestResultEmail("taker@example.com", reading, "legacy-1");

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe("taker@example.com");
    expect(call.subject).toBe(`Your spec is ${SPEC_TYPE_READINGS.grounded_equal.name}`);

    const props = mockEmailComponent.mock.calls[0][0];
    expect(props.specName).toBe(SPEC_TYPE_READINGS.grounded_equal.name);
    expect(props.tagline).toBe(SPEC_TYPE_READINGS.grounded_equal.tagline);
    expect(props.intro).toBe(SPEC_TYPE_READINGS.grounded_equal.intro);
    expect(props.secondaryLine).toBeUndefined();
    expect(props.resultUrl).toContain("/spec-test/result/legacy-1");
  });

  it("sends the v2 composed headline/core-pull plus the secondary-spec line", async () => {
    const reading: SpecTestReading = {
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
    };

    await sendSpecTestResultEmail("taker@example.com", reading, "result-1");

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toBe("Your spec is Quiet Fire");

    const props = mockEmailComponent.mock.calls[0][0];
    expect(props.specName).toBe("Quiet Fire");
    expect(props.tagline).toBe("Composed, private, observant and surprisingly intense.");
    expect(props.intro).toBe("Core reading paragraph.");
    expect(props.secondaryLine).toBe("Right behind it: Brilliant Tease - Intelligent, witty and mentally stimulating.");
    expect(props.resultUrl).toContain("/spec-test/result/result-1");
  });
});
