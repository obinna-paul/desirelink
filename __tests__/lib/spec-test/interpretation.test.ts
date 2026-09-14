import { composeSpecTestResult, type ComposeInput } from "@/lib/spec-test/interpretation/compose";
import { ARCHETYPE_READINGS_V2 } from "@/lib/spec-test/interpretation/readings-v2";
import { allPatternFlagCopy, evaluatePatternFlags, patternFlagIds, type PatternFlagInput } from "@/lib/spec-test/interpretation/pattern-flags";
import { ATTACHMENT_READINGS, LENS_INSIGHTS, MOTIVE_READINGS } from "@/lib/spec-test/interpretation/signal-readings";
import {
  ARCHETYPE_KEYS,
  ATTACHMENT_RESPONSE_LABELS,
  LENS_KEYS,
  MOTIVE_KEYS,
  type ArchetypeKey,
  type LensKey,
  type MotiveKey,
} from "@/lib/spec-test/taxonomy";

// Acceptance criteria from docs/spec-test-v2-implementation-plan.md §9.

function neutralMotives(): Record<MotiveKey, number> {
  return Object.fromEntries(MOTIVE_KEYS.map((key) => [key, 50])) as Record<MotiveKey, number>;
}

function neutralLenses(): Record<LensKey, number> {
  return Object.fromEntries(LENS_KEYS.map((key) => [key, 50])) as Record<LensKey, number>;
}

function baseFlagInput(overrides: Partial<PatternFlagInput> = {}): PatternFlagInput {
  return {
    motiveScores: neutralMotives(),
    lenses: neutralLenses(),
    attachment: null,
    ...overrides,
  };
}

function composeInputFor(primarySpec: ArchetypeKey, overrides: Partial<ComposeInput> = {}): ComposeInput {
  const secondarySpec = ARCHETYPE_KEYS.find((key) => key !== primarySpec)!;
  return {
    primarySpec,
    secondarySpec,
    confidence: "clear",
    motiveScores: neutralMotives(),
    lenses: neutralLenses(),
    attachment: { anxiety: 40, avoidance: 40, label: "steadyUnderUncertainty" },
    sparkPrimarySpec: primarySpec,
    partnershipPrimarySpec: primarySpec,
    ...overrides,
  };
}

describe("readings-v2 content completeness", () => {
  it("gives every archetype a non-empty value for every narrative field", () => {
    for (const key of ARCHETYPE_KEYS) {
      const reading = ARCHETYPE_READINGS_V2[key];
      expect(reading.name.length).toBeGreaterThan(0);
      expect(reading.tagline.length).toBeGreaterThan(0);
      expect(reading.coreReading.length).toBeGreaterThan(0);
      expect(reading.whatItSaysAboutYou.length).toBeGreaterThan(0);
      expect(reading.strength.length).toBeGreaterThan(0);
      expect(reading.blindSpot.length).toBeGreaterThan(0);
      expect(reading.longTermFit.length).toBeGreaterThan(0);
      expect(reading.growthPrompt.length).toBeGreaterThan(0);
    }
  });
});

describe("composeSpecTestResult", () => {
  it("composes a complete reading for every archetype as primary", () => {
    for (const key of ARCHETYPE_KEYS) {
      const copy = composeSpecTestResult(composeInputFor(key));
      expect(copy.primarySpec).toBe(key);
      expect(copy.headline.name).toBe(ARCHETYPE_READINGS_V2[key].name);
      expect(copy.corePull).toBe(ARCHETYPE_READINGS_V2[key].coreReading);
      expect(copy.secondaryInfluence).toContain(ARCHETYPE_READINGS_V2[copy.secondarySpec].name);
    }
  });

  it("includes the spark/partnership twist only on a split result", () => {
    const clear = composeSpecTestResult(composeInputFor("quiet_fire", { confidence: "clear" }));
    expect(clear.sparkPartnershipTwist).toBeNull();

    const split = composeSpecTestResult(
      composeInputFor("quiet_fire", { confidence: "split", sparkPrimarySpec: "electric_charmer", partnershipPrimarySpec: "grounded_equal" }),
    );
    expect(split.sparkPartnershipTwist).not.toBeNull();
    expect(split.sparkPartnershipTwist?.sparkSpec).toBe("electric_charmer");
    expect(split.sparkPartnershipTwist?.partnershipSpec).toBe("grounded_equal");
  });

  it("never fabricates a dating-loop module when no pattern flag converged", () => {
    const copy = composeSpecTestResult(composeInputFor("grounded_equal"));
    expect(copy.datingLoop).toEqual([]);
  });

  // Note: this is enforced at the type level, not at runtime - ComposeInput has no
  // "low_signal" variant, so there is no value you could pass here that both type-checks and
  // represents a low-signal result. A low-signal decision simply cannot reach this function.

  it("surfaces the taker's own top 3 motives by score, not the fixed archetype copy", () => {
    const motiveScores = { ...neutralMotives(), cognitivePlay: 90, agencyDirection: 80, warmthResponsiveness: 70 };
    const copy = composeSpecTestResult(composeInputFor("quiet_fire", { motiveScores }));

    expect(copy.topMotives).toHaveLength(3);
    expect(copy.topMotives.map((signal) => signal.key)).toEqual(["cognitivePlay", "agencyDirection", "warmthResponsiveness"]);
    expect(copy.topMotives[0].copy).toBe(MOTIVE_READINGS.cognitivePlay);
  });

  it("surfaces an attachment insight matching the taker's own attachment label", () => {
    const copy = composeSpecTestResult(composeInputFor("quiet_fire", { attachment: { anxiety: 80, avoidance: 20, label: "reassuranceSensitive" } }));
    expect(copy.attachmentInsight).toEqual({
      label: "reassuranceSensitive",
      title: ATTACHMENT_READINGS.reassuranceSensitive.title,
      copy: ATTACHMENT_READINGS.reassuranceSensitive.copy,
    });
  });

  it("omits the attachment insight when no attachment item was ever answered", () => {
    const copy = composeSpecTestResult(composeInputFor("quiet_fire", { attachment: null }));
    expect(copy.attachmentInsight).toBeNull();
  });

  it("surfaces the taker's single most extreme lens, in the direction it actually leans", () => {
    const high = composeSpecTestResult(
      composeInputFor("quiet_fire", { lenses: { ...neutralLenses(), directnessIntrigue: 90, fastSlow: 60 } }),
    );
    expect(high.lensInsight.key).toBe("directnessIntrigue");
    expect(high.lensInsight.pole).toBe("high");
    expect(high.lensInsight.copy).toBe(LENS_INSIGHTS.directnessIntrigue.high.copy);

    const low = composeSpecTestResult(
      composeInputFor("quiet_fire", { lenses: { ...neutralLenses(), closenessAutonomy: 5 } }),
    );
    expect(low.lensInsight.key).toBe("closenessAutonomy");
    expect(low.lensInsight.pole).toBe("low");
    expect(low.lensInsight.copy).toBe(LENS_INSIGHTS.closenessAutonomy.low.copy);
  });

  it("always includes a lens insight, unlike attachment which can be null", () => {
    const copy = composeSpecTestResult(composeInputFor("quiet_fire", { lenses: neutralLenses() }));
    expect(copy.lensInsight).toBeTruthy();
  });
});

describe("pattern flags require converging conditions", () => {
  it("fires nothing on an entirely neutral profile", () => {
    expect(evaluatePatternFlags(baseFlagInput())).toEqual([]);
  });

  it("ambiguity_amplification needs both high intrigue and reassurance-sensitivity, not either alone", () => {
    const intrigueOnly = baseFlagInput({ motiveScores: { ...neutralMotives(), intrigueSelectiveAccess: 80 } });
    expect(evaluatePatternFlags(intrigueOnly).map((f) => f.id)).not.toContain("ambiguity_amplification");

    const attachmentOnly = baseFlagInput({ attachment: { anxiety: 80, avoidance: 20, label: "reassuranceSensitive" } });
    expect(evaluatePatternFlags(attachmentOnly).map((f) => f.id)).not.toContain("ambiguity_amplification");

    const both = baseFlagInput({
      motiveScores: { ...neutralMotives(), intrigueSelectiveAccess: 80 },
      attachment: { anxiety: 80, avoidance: 20, label: "reassuranceSensitive" },
    });
    expect(evaluatePatternFlags(both).map((f) => f.id)).toContain("ambiguity_amplification");
  });

  it("caretaking_imbalance needs both high warmth and low reciprocity, not either alone", () => {
    const warmthOnly = baseFlagInput({ motiveScores: { ...neutralMotives(), warmthResponsiveness: 80 } });
    expect(evaluatePatternFlags(warmthOnly).map((f) => f.id)).not.toContain("caretaking_imbalance");

    const reciprocityOnly = baseFlagInput({ motiveScores: { ...neutralMotives(), reliabilityReciprocity: 20 } });
    expect(evaluatePatternFlags(reciprocityOnly).map((f) => f.id)).not.toContain("caretaking_imbalance");

    const both = baseFlagInput({ motiveScores: { ...neutralMotives(), warmthResponsiveness: 80, reliabilityReciprocity: 20 } });
    expect(evaluatePatternFlags(both).map((f) => f.id)).toContain("caretaking_imbalance");
  });

  it("fast_burn_undercurrent needs all three of vitality, fast burn and low reciprocity", () => {
    const twoOfThree = baseFlagInput({
      motiveScores: { ...neutralMotives(), socialVitality: 80, reliabilityReciprocity: 20 },
      lenses: neutralLenses(), // fastSlow left neutral
    });
    expect(evaluatePatternFlags(twoOfThree).map((f) => f.id)).not.toContain("fast_burn_undercurrent");

    const allThree = baseFlagInput({
      motiveScores: { ...neutralMotives(), socialVitality: 80, reliabilityReciprocity: 20 },
      lenses: { ...neutralLenses(), fastSlow: 80 },
    });
    expect(evaluatePatternFlags(allThree).map((f) => f.id)).toContain("fast_burn_undercurrent");
  });

  it("declares at least 8 rules, each with copy that carries a hedge", () => {
    const HEDGE_WORDS = /\b(may|might|can sometimes|could)\b/i;
    expect(patternFlagIds().length).toBeGreaterThanOrEqual(8);
    for (const flag of allPatternFlagCopy()) {
      expect(flag.copy).toMatch(HEDGE_WORDS);
    }
  });
});

describe("safety lint - no clinical/diagnostic or ranking language", () => {
  const BANNED_TERMS = [
    /narcissist/i,
    /\btrauma\b/i,
    /abandonment/i,
    /attachment disorder/i,
    /codependent/i,
    /more marriageable/i,
    /more feminine/i,
    /more masculine/i,
    /healthier than/i,
    /better than the/i,
  ];

  function allCopyStrings(): string[] {
    const strings: string[] = [];
    for (const key of ARCHETYPE_KEYS) {
      const reading = ARCHETYPE_READINGS_V2[key];
      strings.push(
        reading.tagline,
        reading.coreReading,
        reading.whatItSaysAboutYou,
        reading.strength,
        reading.blindSpot,
        reading.longTermFit,
        reading.growthPrompt,
      );
    }
    for (const flag of allPatternFlagCopy()) {
      strings.push(flag.copy);
    }
    for (const key of MOTIVE_KEYS) {
      strings.push(MOTIVE_READINGS[key]);
    }
    for (const label of ATTACHMENT_RESPONSE_LABELS) {
      strings.push(ATTACHMENT_READINGS[label].title, ATTACHMENT_READINGS[label].copy);
    }
    for (const key of LENS_KEYS) {
      for (const pole of ["low", "high"] as const) {
        const reading = LENS_INSIGHTS[key][pole];
        strings.push(reading.title, reading.copy, reading.partnerNote);
      }
    }
    return strings;
  }

  it("contains no clinical, diagnostic, or type-ranking language in any archetype reading", () => {
    for (const text of allCopyStrings()) {
      for (const banned of BANNED_TERMS) {
        expect(text).not.toMatch(banned);
      }
    }
  });

  it("contains no banned language in any pattern-flag copy", () => {
    for (const flag of allPatternFlagCopy()) {
      for (const banned of BANNED_TERMS) {
        expect(flag.copy).not.toMatch(banned);
      }
    }
  });
});
