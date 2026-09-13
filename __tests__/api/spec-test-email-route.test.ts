jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 })),
  },
}));
jest.mock("@/lib/prisma", () => ({
  prisma: { specTestResult: { update: jest.fn() } },
}));
jest.mock("@/lib/spec-test", () => ({ getSpecTestReading: jest.fn() }));
jest.mock("@/lib/email/spec-test-notifications", () => ({ sendSpecTestResultEmail: jest.fn().mockResolvedValue(true) }));

import { Prisma } from "@prisma/client";

import { POST } from "@/app/api/spec-test/result/[id]/email/route";
import { prisma } from "@/lib/prisma";
import { getSpecTestReading } from "@/lib/spec-test";
import { sendSpecTestResultEmail } from "@/lib/email/spec-test-notifications";

const mockPrisma = prisma as unknown as { specTestResult: { update: jest.Mock } };
const mockGetReading = getSpecTestReading as jest.Mock;
const mockSendEmail = sendSpecTestResultEmail as jest.Mock;

function post(body: unknown, id = "result-1") {
  return POST(
    new Request("http://localhost/api/spec-test/result/x/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: { id } },
  );
}

describe("POST /api/spec-test/result/[id]/email", () => {
  beforeEach(() => jest.clearAllMocks());

  it("saves the email/consent, then sends through the version-aware reading", async () => {
    mockPrisma.specTestResult.update.mockResolvedValue({ id: "result-1" });
    const reading = { version: "v2", copy: { headline: { name: "Quiet Fire" } } };
    mockGetReading.mockResolvedValue(reading);

    const response = await post({ email: "taker@example.com", consentMarketing: true });

    expect(response).toMatchObject({ status: 200, body: { ok: true } });
    expect(mockPrisma.specTestResult.update).toHaveBeenCalledWith({
      where: { id: "result-1" },
      data: { email: "taker@example.com", consentMarketing: true },
      select: { id: true },
    });
    expect(mockGetReading).toHaveBeenCalledWith("result-1");
    expect(mockSendEmail).toHaveBeenCalledWith("taker@example.com", reading, "result-1");
  });

  it("rejects an invalid email without touching the database", async () => {
    const response = await post({ email: "not-an-email" });
    expect(response.status).toBe(400);
    expect(mockPrisma.specTestResult.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the result row does not exist", async () => {
    mockPrisma.specTestResult.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("not found", { code: "P2025", clientVersion: "6.19.3" }),
    );
    const response = await post({ email: "taker@example.com" }, "missing");
    expect(response.status).toBe(404);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("still returns ok if the reading can't be found post-update, without sending an email", async () => {
    mockPrisma.specTestResult.update.mockResolvedValue({ id: "result-1" });
    mockGetReading.mockResolvedValue(null);

    const response = await post({ email: "taker@example.com" });

    expect(response).toMatchObject({ status: 200, body: { ok: true } });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
