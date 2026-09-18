jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
const mockCookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
jest.mock("next/headers", () => ({ cookies: () => mockCookieStore }));
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 })),
  },
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    specTestResult: { create: jest.fn(), findFirst: jest.fn() },
    specTestInstrumentStat: { upsert: jest.fn().mockResolvedValue({}) },
    specTestFormStat: { upsert: jest.fn().mockResolvedValue({}) },
    profile: { findUnique: jest.fn() },
  },
}));

import { getServerSession } from "next-auth";

import { POST } from "@/app/api/spec-test/submit/route";
import { prisma } from "@/lib/prisma";
import { SPEC_TEST_ITEMS_V3, V3_INSTRUMENT_VERSION } from "@/lib/spec-test/items/spec-v3";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import { V3_PILOT_BLOCK_DIMENSIONS, V3_PILOT_INTENSITY_DIMENSIONS } from "@/lib/spec-test/scoring/pilot-v3";
import type { ScoringDimensionKey } from "@/lib/spec-test/taxonomy";

const mockSession = getServerSession as jest.Mock;
const mockPrisma = prisma as unknown as {
  specTestResult: { create: jest.Mock; findFirst: jest.Mock };
  specTestInstrumentStat: { upsert: jest.Mock };
  specTestFormStat: { upsert: jest.Mock };
  profile: { findUnique: jest.Mock };
};

function responsesFor(target: ScoringDimensionKey = "socialVitality"): SpecTestResponseV3[] {
  return SPEC_TEST_ITEMS_V3.map((item) => {
    if (item.kind === "best_worst") {
      const dimensions = V3_PILOT_BLOCK_DIMENSIONS[item.id];
      const bestIndex = Math.max(0, dimensions.indexOf(target));
      const worstIndex = [0, 1, 2, 3].find((index) => index !== bestIndex) ?? 0;
      return {
        itemId: item.id,
        kind: "best_worst",
        bestOptionId: item.options[bestIndex].id,
        worstOptionId: item.options[worstIndex].id,
        bestPresentedIndex: bestIndex,
        worstPresentedIndex: worstIndex,
        elapsedMs: 2400,
      };
    }
    if (item.kind === "intensity") {
      return {
        itemId: item.id,
        kind: "intensity",
        rating: V3_PILOT_INTENSITY_DIMENSIONS[item.id] === target ? 7 : 2,
        elapsedMs: 1800,
      };
    }
    return {
      itemId: item.id,
      kind: "single_choice",
      optionId: item.options[0].id,
      presentedIndex: 0,
      elapsedMs: 1700,
    };
  });
}

function payload(gender: "male" | "female" = "male") {
  return { instrumentVersion: V3_INSTRUMENT_VERSION, gender, responses: responsesFor() };
}

function post(body: unknown, ip: string) {
  return POST(new Request("http://localhost/api/spec-test/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  }));
}

describe("POST /api/spec-test/submit - official v3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue(null);
    mockPrisma.specTestResult.findFirst.mockResolvedValue(null);
  });

  it("scores all 28 answers and persists the complete detailed-result model", async () => {
    mockPrisma.specTestResult.create.mockResolvedValue({ id: "official-v3-result" });

    const response = await post(payload("male"), "198.51.100.101");

    expect(response).toMatchObject({ status: 201, body: { resultId: "official-v3-result" } });
    const data = mockPrisma.specTestResult.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      instrumentVersion: V3_INSTRUMENT_VERSION,
      specType: "electric_charmer",
      gender: "male",
      quizForm: "male_user",
      assumedAttractionTarget: "female",
      routingRule: "heterosexual_v0_1",
      responseQuality: "usable",
      dataSplit: "development",
      profileId: null,
    });
    expect(data.answers).toHaveLength(28);
    expect(data.secondarySpec).toBeTruthy();
    expect(data.motiveScores).toHaveProperty("motives");
    expect(data.motiveScores).toHaveProperty("facets");
    expect(data.lenses).toBeDefined();
    expect(data.attachment).toBeDefined();
    expect(Array.isArray(data.patternFlags)).toBe(true);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "spec_test_result_id",
      "official-v3-result",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("requires gender and rejects incomplete or tampered response sets", async () => {
    const noGender = payload() as Record<string, unknown>;
    delete noGender.gender;
    expect((await post(noGender, "198.51.100.102")).status).toBe(400);

    const incomplete = payload();
    expect((await post({ ...incomplete, responses: incomplete.responses.slice(1) }, "198.51.100.103")).status).toBe(400);

    const tampered = payload();
    tampered.responses[0] = {
      ...tampered.responses[0],
      bestOptionId: "not-a-real-option",
    } as SpecTestResponseV3;
    expect((await post(tampered, "198.51.100.104")).status).toBe(400);
    expect(mockPrisma.specTestResult.create).not.toHaveBeenCalled();
  });

  it("derives male wording for a female taker", async () => {
    mockPrisma.specTestResult.create.mockResolvedValue({ id: "official-v3-female" });

    const response = await post(payload("female"), "198.51.100.105");

    expect(response.status).toBe(201);
    expect(mockPrisma.specTestResult.create.mock.calls[0][0].data).toMatchObject({
      gender: "female",
      quizForm: "female_user",
      assumedAttractionTarget: "male",
    });
  });

  it("scopes the signed-in cooldown to official v3 results", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-v3" } });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: "profile-v3" });
    mockPrisma.specTestResult.findFirst.mockResolvedValue({
      id: "recent-v3-result",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    const response = await post(payload(), "198.51.100.106");

    expect(response).toMatchObject({ status: 429, body: { resultId: "recent-v3-result" } });
    expect(mockPrisma.specTestResult.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { profileId: "profile-v3", instrumentVersion: V3_INSTRUMENT_VERSION },
    }));
    expect(mockPrisma.specTestResult.create).not.toHaveBeenCalled();
  });
});
