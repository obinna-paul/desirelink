jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    specTestResult: { create: jest.fn() },
  },
}));

import { POST } from "@/app/api/spec-test/submit/route";
import { prisma } from "@/lib/prisma";
import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { INSTRUMENT_VERSION } from "@/lib/spec-test/taxonomy";
import { specTestQuestionIds } from "@/lib/spec-test";

const mockPrisma = prisma as unknown as { specTestResult: { create: jest.Mock } };

function post(body: unknown, ip = "203.0.113.1") {
  return POST(
    new Request("http://localhost/api/spec-test/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

function v2ResponsePayload(overrides: Record<string, "a" | "b" | "c" | "d" | "skip"> = {}) {
  const responses = SPEC_TEST_ITEMS_V2.map((item, index) => {
    const choice = overrides[item.id] ?? (["a", "b", "c", "d"] as const)[index % 4];
    if (choice === "skip") {
      return { itemId: item.id, optionId: null, presentedIndex: null, elapsedMs: 0, skipped: true };
    }
    const optionIndex = ["a", "b", "c", "d"].indexOf(choice);
    return {
      itemId: item.id,
      optionId: item.options[optionIndex].id,
      presentedIndex: optionIndex,
      elapsedMs: 2500 + index * 40,
    };
  });
  return { instrumentVersion: INSTRUMENT_VERSION, responses };
}

describe("POST /api/spec-test/submit - legacy v1 payload", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps scoring and persisting a v1 { answers } payload exactly as before", async () => {
    const answers = Object.fromEntries(specTestQuestionIds().map((id) => [id, "A" as const]));
    mockPrisma.specTestResult.create.mockResolvedValue({ id: "legacy-result-1" });

    const response = await post({ answers });

    expect(response).toMatchObject({ status: 201, body: { resultId: "legacy-result-1" } });
    expect(mockPrisma.specTestResult.create).toHaveBeenCalledTimes(1);
    const call = mockPrisma.specTestResult.create.mock.calls[0][0];
    expect(call.data.answers).toEqual(answers);
    expect(typeof call.data.specType).toBe("string");
    // The legacy path must not start writing v2-only fields - it's untouched behavior.
    expect(call.data).not.toHaveProperty("instrumentVersion");
    expect(call.data).not.toHaveProperty("motiveScores");
  });

  it("rejects an incomplete v1 answer set", async () => {
    const response = await post({ answers: { "rooftop-party": "A" } });
    expect(response.status).toBe(400);
    expect(mockPrisma.specTestResult.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/spec-test/submit - v2 payload", () => {
  beforeEach(() => jest.clearAllMocks());

  it("scores and persists a valid, usable v2 response set", async () => {
    mockPrisma.specTestResult.create.mockResolvedValue({ id: "v2-result-1" });

    const response = await post(v2ResponsePayload(), "203.0.113.10");

    expect(response.status).toBe(201);
    expect((response as unknown as { body: { resultId: string; confidence: string } }).body.resultId).toBe("v2-result-1");
    expect(mockPrisma.specTestResult.create).toHaveBeenCalledTimes(1);

    const data = mockPrisma.specTestResult.create.mock.calls[0][0].data;
    expect(data.instrumentVersion).toBe(INSTRUMENT_VERSION);
    expect(typeof data.specType).toBe("string");
    expect(typeof data.secondarySpec).toBe("string");
    expect(data.motiveScores).toHaveProperty("motives");
    expect(data.motiveScores).toHaveProperty("facets");
    expect(data.lenses).toBeDefined();
    expect(data.attachment).not.toBeNull();
    expect(["clear", "blend", "split"]).toContain(data.resultConfidence);
    expect(data.responseQuality).toBe("usable");
    expect(Array.isArray(data.answers)).toBe(true);
    expect(data.answers).toHaveLength(SPEC_TEST_ITEMS_V2.length);
  });

  it("does not persist a row and reports lowSignal for a low-signal response", async () => {
    // Skip enough items to exceed the cap (see SKIP_CAP in scoring/quality.ts).
    const overrides = Object.fromEntries(SPEC_TEST_ITEMS_V2.slice(0, 5).map((item) => [item.id, "skip" as const]));
    const response = await post(v2ResponsePayload(overrides), "203.0.113.11");

    expect(response.status).toBe(200);
    expect((response as unknown as { body: { lowSignal: boolean } }).body.lowSignal).toBe(true);
    expect(mockPrisma.specTestResult.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown instrument version", async () => {
    const payload = v2ResponsePayload();
    const response = await post({ ...payload, instrumentVersion: "spec-v99" }, "203.0.113.12");
    expect(response.status).toBe(400);
    expect(mockPrisma.specTestResult.create).not.toHaveBeenCalled();
  });

  it("rejects a response set with a missing item (wrong length)", async () => {
    const payload = v2ResponsePayload();
    const response = await post({ ...payload, responses: payload.responses.slice(1) }, "203.0.113.13");
    expect(response.status).toBe(400);
    expect(mockPrisma.specTestResult.create).not.toHaveBeenCalled();
  });

  it("rejects a response set with an item id that does not belong to the declared bank", async () => {
    const payload = v2ResponsePayload();
    const tampered = [...payload.responses.slice(1), { itemId: "not-a-real-item", optionId: "x", presentedIndex: 0, elapsedMs: 1000 }];
    const response = await post({ ...payload, responses: tampered }, "203.0.113.14");
    expect(response.status).toBe(400);
    expect(mockPrisma.specTestResult.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate item id", async () => {
    const payload = v2ResponsePayload();
    // Same length (24), but item[0] appears twice and the last item is missing entirely.
    const tampered = [...payload.responses.slice(0, -1), payload.responses[0]];
    const response = await post({ ...payload, responses: tampered }, "203.0.113.15");
    expect(response.status).toBe(400);
    expect(mockPrisma.specTestResult.create).not.toHaveBeenCalled();
  });

  it("rejects an optionId that does not belong to the answered item", async () => {
    const payload = v2ResponsePayload();
    const tampered = payload.responses.map((response, index) =>
      index === 0 ? { ...response, optionId: "some-other-items-option-a" } : response,
    );
    const response = await post({ ...payload, responses: tampered }, "203.0.113.16");
    expect(response.status).toBe(400);
    expect(mockPrisma.specTestResult.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/spec-test/submit - rate limiting", () => {
  it("returns 429 once an IP exceeds the submit rate limit", async () => {
    mockPrisma.specTestResult.create.mockResolvedValue({ id: "rate-limit-result" });
    const ip = "203.0.113.200";
    const payload = v2ResponsePayload();

    let lastResponse;
    for (let i = 0; i < 21; i += 1) {
      lastResponse = await post(payload, ip);
    }

    expect(lastResponse?.status).toBe(429);
  });
});
