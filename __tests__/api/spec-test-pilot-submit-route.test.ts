jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 })),
  },
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    specTestPilotSubmission: { create: jest.fn() },
    specTestPilotAttempt: { upsert: jest.fn() },
  },
}));

import { POST } from "@/app/api/spec-test/pilot/submit/route";
import { prisma } from "@/lib/prisma";
import {
  SPEC_TEST_ITEMS_V3_PILOT,
  V3_PILOT_INSTRUMENT_VERSION,
} from "@/lib/spec-test/items/spec-v3-pilot";
import { V3_PILOT_CONSENT_VERSION } from "@/lib/spec-test/pilot-v3-feature";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";

const mockCreate = (prisma as unknown as { specTestPilotSubmission: { create: jest.Mock } })
  .specTestPilotSubmission.create;

function validResponses(elapsedMs = 2_500): SpecTestResponseV3[] {
  return SPEC_TEST_ITEMS_V3_PILOT.map((item) => {
    if (item.kind === "best_worst") {
      return {
        itemId: item.id,
        kind: "best_worst" as const,
        bestOptionId: item.options[0].id,
        worstOptionId: item.options[1].id,
        bestPresentedIndex: 0,
        worstPresentedIndex: 1,
        elapsedMs,
      };
    }
    if (item.kind === "intensity") {
      return { itemId: item.id, kind: "intensity" as const, rating: 4 as const, elapsedMs };
    }
    return {
      itemId: item.id,
      kind: "single_choice" as const,
      optionId: item.options[0].id,
      presentedIndex: 0,
      elapsedMs,
    };
  });
}

function payload(responses = validResponses()) {
  return {
    attemptId: "550e8400-e29b-41d4-a716-446655440000",
    instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
    researchConsent: true,
    consentVersion: V3_PILOT_CONSENT_VERSION,
    responses,
  };
}

function post(body: unknown, ip: string) {
  return POST(
    new Request("http://localhost/api/spec-test/pilot/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/spec-test/pilot/submit", () => {
  const previousFlag = process.env.SPEC_TEST_V3_PILOT_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SPEC_TEST_V3_PILOT_ENABLED = "true";
    mockCreate.mockResolvedValue({ id: "pilot-submission-1" });
  });

  afterAll(() => {
    if (previousFlag === undefined) delete process.env.SPEC_TEST_V3_PILOT_ENABLED;
    else process.env.SPEC_TEST_V3_PILOT_ENABLED = previousFlag;
  });

  it("is unavailable while the feature flag is off", async () => {
    process.env.SPEC_TEST_V3_PILOT_ENABLED = "false";
    expect(await post(payload(), "203.0.113.30")).toMatchObject({ status: 404 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("requires explicit research consent", async () => {
    expect(await post({ ...payload(), researchConsent: false }, "203.0.113.31")).toMatchObject({ status: 400 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("stores a valid submission anonymously with separate research profiles", async () => {
    const response = await post(payload(), "203.0.113.32");
    expect(response).toMatchObject({ status: 201, body: { submissionId: "pilot-submission-1" } });
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.instrumentVersion).toBe(V3_PILOT_INSTRUMENT_VERSION);
    expect(data.attemptId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(data.consentVersion).toBe(V3_PILOT_CONSENT_VERSION);
    expect(data.responses).toHaveLength(28);
    expect(data.attractionProfile.warmthResponsiveness).toBeDefined();
    expect(data.uncertaintyProfile).toEqual({
      steadyUnderUncertainty: 3,
      reassuranceSensitive: 1,
      spaceProtective: 0,
      pushPull: 0,
    });
    expect(data).not.toHaveProperty("profileId");
    expect(data).not.toHaveProperty("email");
    expect((prisma as unknown as { specTestPilotAttempt: { upsert: jest.Mock } }).specTestPilotAttempt.upsert)
      .toHaveBeenCalledWith(expect.objectContaining({ where: { id: data.attemptId } }));
  });

  it("rejects duplicate, missing, or contradictory response records", async () => {
    const responses = validResponses();
    responses[1] = { ...responses[0] };
    expect(await post(payload(responses), "203.0.113.33")).toMatchObject({ status: 400 });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("retains low-quality pilot rows but marks them for analysis", async () => {
    await post(payload(validResponses(100)), "203.0.113.34");
    expect(mockCreate.mock.calls[0][0].data.qualityFlags).toContain("too_fast");
  });

  it("still succeeds when optional completion telemetry fails after the response is stored", async () => {
    const telemetry = (prisma as unknown as { specTestPilotAttempt: { upsert: jest.Mock } })
      .specTestPilotAttempt.upsert;
    telemetry.mockRejectedValueOnce(new Error("telemetry unavailable"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await post(payload(), "203.0.113.35")).toMatchObject({ status: 201 });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
