jest.mock("@/lib/prisma", () => ({
  prisma: { specTestResult: { findUnique: jest.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { getSpecTestReading } from "@/lib/spec-test/results";
import { decideSpecTestResultForVersion } from "@/lib/spec-test/scoring/decide";
import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { INSTRUMENT_VERSION } from "@/lib/spec-test/taxonomy";
import { ARCHETYPE_CENTROIDS } from "@/lib/spec-test/scoring/archetypes";
import { OPTION_MOTIVE_LOADINGS } from "@/lib/spec-test/scoring/loadings";
import { SPEC_TYPE_READINGS } from "@/lib/spec-test/legacy";
import { routeForm } from "@/lib/spec-test/gender/forms";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";

const mockPrisma = prisma as unknown as { specTestResult: { findUnique: jest.Mock } };

function baselineResponses(): SpecTestResponseV2[] {
  return SPEC_TEST_ITEMS_V2.map((item, index) => {
    const optionIndex = item.options.reduce((bestIndex, option, candidateIndex) => {
      const bestDimension = OPTION_MOTIVE_LOADINGS[item.options[bestIndex].id];
      const dimension = OPTION_MOTIVE_LOADINGS[option.id];
      const bestValue = bestDimension ? ARCHETYPE_CENTROIDS.electric_charmer[bestDimension] : -Infinity;
      const value = dimension ? ARCHETYPE_CENTROIDS.electric_charmer[dimension] : -Infinity;
      return value > bestValue ? candidateIndex : bestIndex;
    }, index % 4);
    return {
      itemId: item.id,
      optionId: item.options[optionIndex].id,
      presentedIndex: optionIndex,
      elapsedMs: 2500 + index * 40,
    };
  });
}

describe("getSpecTestReading - v2 round-trip", () => {
  it("reads back a v2 row into the same primary/secondary/confidence the engine produced", async () => {
    const responses = baselineResponses();
    const decision = decideSpecTestResultForVersion(INSTRUMENT_VERSION, SPEC_TEST_ITEMS_V2, responses);
    if (decision.quality !== "usable") throw new Error("fixture expected a usable decision");

    // Mirrors exactly what app/api/spec-test/submit/route.ts writes for a v2 row.
    mockPrisma.specTestResult.findUnique.mockResolvedValue({
      id: "result-1",
      specType: decision.primarySpec,
      instrumentVersion: INSTRUMENT_VERSION,
      secondarySpec: decision.secondarySpec,
      motiveScores: { motives: decision.motiveScores, facets: decision.motiveFacets },
      lenses: decision.lenses,
      attachment: decision.attachment,
      sparkSpec: decision.sparkPrimarySpec,
      partnershipSpec: decision.partnershipPrimarySpec,
      patternFlags: [],
      resultConfidence: decision.confidence,
    });

    const reading = await getSpecTestReading("result-1");
    expect(reading).not.toBeNull();
    if (reading?.version !== "v2") throw new Error("expected a v2 reading");

    expect(reading.primarySpec).toBe(decision.primarySpec);
    expect(reading.secondarySpec).toBe(decision.secondarySpec);
    expect(reading.confidence).toBe(decision.confidence);
    expect(reading.motiveScores).toEqual(decision.motiveScores);
    expect(reading.motiveFacets).toEqual(decision.motiveFacets);
    expect(reading.lenses).toEqual(decision.lenses);
    expect(reading.attachment).toEqual(decision.attachment);
    expect(reading.sparkSpec).toBe(decision.sparkPrimarySpec);
    expect(reading.partnershipSpec).toBe(decision.partnershipPrimarySpec);
  });
});

describe("getSpecTestReading - gender rendering", () => {
  it("renders copy for the row's stored quizForm, and stores the routing artifacts as-is", async () => {
    const responses = baselineResponses();
    const decision = decideSpecTestResultForVersion(INSTRUMENT_VERSION, SPEC_TEST_ITEMS_V2, responses);
    if (decision.quality !== "usable") throw new Error("fixture expected a usable decision");
    const routing = routeForm("male");

    mockPrisma.specTestResult.findUnique.mockResolvedValue({
      id: "result-2",
      specType: decision.primarySpec,
      instrumentVersion: INSTRUMENT_VERSION,
      secondarySpec: decision.secondarySpec,
      motiveScores: { motives: decision.motiveScores, facets: decision.motiveFacets },
      lenses: decision.lenses,
      attachment: decision.attachment,
      sparkSpec: decision.sparkPrimarySpec,
      partnershipSpec: decision.partnershipPrimarySpec,
      patternFlags: [],
      resultConfidence: decision.confidence,
      gender: "male",
      routingRule: routing.routingRule,
      assumedAttractionTarget: routing.assumedAttractionTarget,
      quizForm: routing.quizForm,
    });

    const reading = await getSpecTestReading("result-2");
    if (reading?.version !== "v2") throw new Error("expected a v2 reading");

    expect(reading.gender).toBe("male");
    expect(reading.routingRule).toBe("heterosexual_v0_1");
    expect(reading.assumedAttractionTarget).toBe("female");
    expect(reading.quizForm).toBe("male_user");
    // male_user renders the other person as female - nothing in the rendered copy should
    // leak an unrendered token.
    expect(reading.copy.corePull).not.toMatch(/[{}]/);
    expect(reading.copy.whatItSaysAboutYou).not.toMatch(/[{}]/);
  });

  it("falls back to neutral rendering when a v2 row has no stored gender/form", async () => {
    const responses = baselineResponses();
    const decision = decideSpecTestResultForVersion(INSTRUMENT_VERSION, SPEC_TEST_ITEMS_V2, responses);
    if (decision.quality !== "usable") throw new Error("fixture expected a usable decision");

    mockPrisma.specTestResult.findUnique.mockResolvedValue({
      id: "result-3",
      specType: decision.primarySpec,
      instrumentVersion: "spec-v2.0",
      secondarySpec: decision.secondarySpec,
      motiveScores: { motives: decision.motiveScores, facets: decision.motiveFacets },
      lenses: decision.lenses,
      attachment: decision.attachment,
      sparkSpec: decision.sparkPrimarySpec,
      partnershipSpec: decision.partnershipPrimarySpec,
      patternFlags: [],
      resultConfidence: decision.confidence,
      gender: null,
      routingRule: null,
      assumedAttractionTarget: null,
      quizForm: null,
    });

    const reading = await getSpecTestReading("result-3");
    if (reading?.version !== "v2") throw new Error("expected a v2 reading");

    expect(reading.gender).toBeNull();
    expect(reading.quizForm).toBeNull();
    expect(reading.copy.corePull).not.toMatch(/[{}]/);
  });
});

describe("getSpecTestReading - legacy v1 rows", () => {
  it("renders the original v1 reading unchanged for a legacy row", async () => {
    mockPrisma.specTestResult.findUnique.mockResolvedValue({
      id: "legacy-1",
      specType: "quiet_fire",
      instrumentVersion: "spec-v1",
      secondarySpec: null,
      motiveScores: null,
      lenses: null,
      attachment: null,
      sparkSpec: null,
      partnershipSpec: null,
      patternFlags: [],
      resultConfidence: null,
      gender: null,
      routingRule: null,
      assumedAttractionTarget: null,
      quizForm: null,
    });

    const reading = await getSpecTestReading("legacy-1");
    expect(reading).toEqual({
      version: "v1",
      id: "legacy-1",
      specType: "quiet_fire",
      reading: SPEC_TYPE_READINGS.quiet_fire,
      assumedAttractionTarget: null,
    });
  });

  it("carries a stored assumed attraction target through for a v1 row asked post-rollout", async () => {
    mockPrisma.specTestResult.findUnique.mockResolvedValue({
      id: "legacy-2",
      specType: "quiet_fire",
      instrumentVersion: "spec-v1",
      secondarySpec: null,
      motiveScores: null,
      lenses: null,
      attachment: null,
      sparkSpec: null,
      partnershipSpec: null,
      patternFlags: [],
      resultConfidence: null,
      gender: "male",
      routingRule: "heterosexual_v0_1",
      assumedAttractionTarget: "female",
      quizForm: "male_user",
    });

    const reading = await getSpecTestReading("legacy-2");
    expect(reading).toEqual({
      version: "v1",
      id: "legacy-2",
      specType: "quiet_fire",
      reading: SPEC_TYPE_READINGS.quiet_fire,
      assumedAttractionTarget: "female",
    });
  });

  it("returns null for a missing row", async () => {
    mockPrisma.specTestResult.findUnique.mockResolvedValue(null);
    expect(await getSpecTestReading("nope")).toBeNull();
  });
});
