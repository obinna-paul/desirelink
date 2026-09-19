import {
  readAttachmentVector,
  readLensVector,
  readScoringVector,
  scoreSpecVectorCompatibility,
  type SpecVectorResult,
} from "@/lib/spec-test/vector-compatibility";
import { LENS_KEYS, SCORING_DIMENSION_KEYS } from "@/lib/spec-test/taxonomy";

function fullResult(value: number, overrides: Partial<SpecVectorResult> = {}): SpecVectorResult {
  const dimensions = Object.fromEntries(SCORING_DIMENSION_KEYS.map((key) => [key, value]));
  const motives = Object.fromEntries(
    SCORING_DIMENSION_KEYS
      .filter((key) => key !== "containedDepthPrivacy" && key !== "aestheticSelectivity")
      .map((key) => [key, value]),
  );
  const facets = {
    containedDepthPrivacy: dimensions.containedDepthPrivacy,
    aestheticSelectivity: dimensions.aestheticSelectivity,
  };

  return {
    specType: "grounded_equal",
    motiveScores: { motives, facets },
    lenses: Object.fromEntries(LENS_KEYS.map((key) => [key, value])),
    attachment: { anxiety: value, avoidance: value, label: "steadyUnderUncertainty" },
    ...overrides,
  };
}

describe("Spec vector readers", () => {
  it("reconstructs all eight dimensions without double-counting combined intrigue", () => {
    const result = fullResult(64);
    expect(readScoringVector(result)).toEqual(
      Object.fromEntries(SCORING_DIMENSION_KEYS.map((key) => [key, 64])),
    );
    expect(readLensVector(result)).toEqual(Object.fromEntries(LENS_KEYS.map((key) => [key, 64])));
    expect(readAttachmentVector(result)).toEqual({ anxiety: 64, avoidance: 64 });
  });

  it("rejects incomplete, out-of-range and non-numeric vectors", () => {
    expect(readScoringVector({ specType: "soft_landing", motiveScores: { motives: {} } })).toBeNull();
    expect(readLensVector({ specType: "soft_landing", lenses: { sparkSafety: 101 } })).toBeNull();
    expect(readAttachmentVector({ specType: "soft_landing", attachment: { anxiety: "50", avoidance: 50 } })).toBeNull();
  });
});

describe("scoreSpecVectorCompatibility", () => {
  it("gives identical complete profiles a full vector score and coverage", () => {
    const compatibility = scoreSpecVectorCompatibility([fullResult(70)], [fullResult(70)]);

    expect(compatibility).toEqual({
      score: 1,
      coverage: 1,
      source: "vector",
      reason: "Your Spec profiles align",
    });
  });

  it("gives completely opposed complete profiles no boost", () => {
    const compatibility = scoreSpecVectorCompatibility([fullResult(0)], [fullResult(100)]);

    expect(compatibility.score).toBe(0);
    expect(compatibility.coverage).toBe(1);
    expect(compatibility.source).toBe("vector");
    expect(compatibility.reason).toBeNull();
  });

  it("changes dimension emphasis for chemistry versus partnership", () => {
    const viewer = fullResult(80, { lenses: undefined, attachment: undefined });
    const chemistryMismatch = fullResult(80, {
      lenses: undefined,
      attachment: undefined,
      motiveScores: {
        motives: {
          warmthResponsiveness: 80,
          reliabilityReciprocity: 80,
          socialVitality: 20,
          agencyDirection: 80,
          cognitivePlay: 20,
          noveltyAutonomy: 20,
        },
        facets: { containedDepthPrivacy: 80, aestheticSelectivity: 20 },
      },
    });
    const stabilityMismatch = fullResult(80, {
      lenses: undefined,
      attachment: undefined,
      motiveScores: {
        motives: {
          warmthResponsiveness: 20,
          reliabilityReciprocity: 20,
          socialVitality: 80,
          agencyDirection: 80,
          cognitivePlay: 80,
          noveltyAutonomy: 80,
        },
        facets: { containedDepthPrivacy: 80, aestheticSelectivity: 80 },
      },
    });

    const sparkChemistryMismatch = scoreSpecVectorCompatibility([viewer], [chemistryMismatch], "SPARK").score;
    const partnershipChemistryMismatch = scoreSpecVectorCompatibility([viewer], [chemistryMismatch], "PARTNERSHIP").score;
    const sparkStabilityMismatch = scoreSpecVectorCompatibility([viewer], [stabilityMismatch], "SPARK").score;
    const partnershipStabilityMismatch = scoreSpecVectorCompatibility([viewer], [stabilityMismatch], "PARTNERSHIP").score;

    expect(sparkChemistryMismatch).toBeLessThan(partnershipChemistryMismatch);
    expect(partnershipStabilityMismatch).toBeLessThan(sparkStabilityMismatch);
  });

  it("renormalizes available components instead of penalizing missing attachment data", () => {
    const left = fullResult(60, { attachment: undefined });
    const right = fullResult(60, { attachment: undefined });
    const compatibility = scoreSpecVectorCompatibility([left], [right]);

    expect(compatibility.score).toBe(1);
    expect(compatibility.coverage).toBeCloseTo(0.9);
    expect(compatibility.source).toBe("vector");
  });

  it("preserves legacy archetype matching when full vectors are unavailable", () => {
    const compatibility = scoreSpecVectorCompatibility(
      [{ specType: "soft_landing" }],
      [{ specType: "grounded_equal" }],
    );

    expect(compatibility).toEqual({ score: 1, coverage: 0, source: "archetype", reason: null });
  });

  it("treats malformed legacy archetype keys as neutral", () => {
    expect(scoreSpecVectorCompatibility(
      [{ specType: "not-a-real-spec" }],
      [{ specType: "grounded_equal" }],
    )).toEqual({ score: 0, coverage: 0, source: "none", reason: null });
  });

  it("returns neutral when either person has no Spec result", () => {
    expect(scoreSpecVectorCompatibility([], [fullResult(50)])).toEqual({
      score: 0,
      coverage: 0,
      source: "none",
      reason: null,
    });
  });
});
