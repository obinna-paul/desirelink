jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 })),
  },
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    specTestPilotAttempt: { upsert: jest.fn(), updateMany: jest.fn() },
  },
}));

import { POST } from "@/app/api/spec-test/pilot/progress/route";
import { prisma } from "@/lib/prisma";
import { V3_PILOT_INSTRUMENT_VERSION } from "@/lib/spec-test/items/spec-v3-pilot";
import { V3_PILOT_CONSENT_VERSION } from "@/lib/spec-test/pilot-v3-feature";

const mockAttempt = (prisma as unknown as {
  specTestPilotAttempt: { upsert: jest.Mock; updateMany: jest.Mock };
}).specTestPilotAttempt;

function post(completedCount: number, ip: string) {
  return POST(
    new Request("http://localhost/api/spec-test/pilot/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({
        attemptId: "550e8400-e29b-41d4-a716-446655440001",
        instrumentVersion: V3_PILOT_INSTRUMENT_VERSION,
        consentVersion: V3_PILOT_CONSENT_VERSION,
        completedCount,
      }),
    }),
  );
}

describe("POST /api/spec-test/pilot/progress", () => {
  const previousFlag = process.env.SPEC_TEST_V3_PILOT_ENABLED;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SPEC_TEST_V3_PILOT_ENABLED = "true";
    mockAttempt.upsert.mockResolvedValue({});
    mockAttempt.updateMany.mockResolvedValue({ count: 1 });
  });
  afterAll(() => {
    if (previousFlag === undefined) delete process.env.SPEC_TEST_V3_PILOT_ENABLED;
    else process.env.SPEC_TEST_V3_PILOT_ENABLED = previousFlag;
  });

  it("creates anonymous start telemetry without answers or identity", async () => {
    expect(await post(0, "203.0.113.40")).toMatchObject({ status: 200, body: { recorded: true } });
    const create = mockAttempt.upsert.mock.calls[0][0].create;
    expect(create.highestCompletedIndex).toBe(0);
    expect(create).not.toHaveProperty("responses");
    expect(create).not.toHaveProperty("profileId");
  });

  it("never regresses the highest completed question when requests arrive out of order", async () => {
    await post(8, "203.0.113.41");
    expect(mockAttempt.upsert.mock.calls[0][0].update).toEqual({});
    expect(mockAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        highestCompletedIndex: { lt: 8 },
      },
      data: { highestCompletedIndex: 8 },
    });
  });

  it("rejects values outside the 28-item instrument", async () => {
    expect(await post(29, "203.0.113.42")).toMatchObject({ status: 400 });
    expect(mockAttempt.upsert).not.toHaveBeenCalled();
  });
});
