jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/admin/access", () => ({ requireCapability: jest.fn() }));
jest.mock("@/lib/admin/audit", () => ({ recordAdminAction: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prisma: { specTestPilotSubmission: { findMany: jest.fn() } },
}));

import { GET } from "@/app/api/admin/spec-test/pilot/export.csv/route";
import { requireCapability } from "@/lib/admin/access";
import { recordAdminAction } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = getServerSession as jest.Mock;
const mockGate = requireCapability as jest.Mock;
const mockAudit = recordAdminAction as jest.Mock;
const mockFindMany = (prisma as unknown as {
  specTestPilotSubmission: { findMany: jest.Mock };
}).specTestPilotSubmission.findMany;

describe("GET /api/admin/spec-test/pilot/export.csv", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "admin-1" } });
    mockGate.mockResolvedValue({ ok: true, role: "SUPERADMIN" });
    mockAudit.mockResolvedValue(undefined);
    mockFindMany.mockResolvedValue([]);
  });

  it("enforces the superadmin-only leads capability before reading pilot data", async () => {
    mockSession.mockResolvedValue(null);
    mockGate.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });

    const response = await GET();
    expect(response.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("exports only the exact instrument and consent version without database identifiers", async () => {
    mockFindMany.mockResolvedValue([
      {
        instrumentVersion: "spec-v3-pilot.1",
        consentVersion: "2026-09-18.2",
        dataSplit: "holdout",
        qualityFlags: [],
        responses: [
          {
            itemId: "v3-intensity-warmth",
            kind: "intensity",
            rating: 6,
            elapsedMs: 2200,
          },
        ],
        attractionProfile: {},
        uncertaintyProfile: {},
      },
    ]);

    const response = await GET();
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("spec-v3-pilot.1-analysis");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instrumentVersion: "spec-v3-pilot.1",
          consentVersion: "2026-09-18.2",
        },
        select: expect.not.objectContaining({ id: true, attemptId: true, createdAt: true }),
      }),
    );
    expect(body).toContain("v3-intensity-warmth,intensity,false,2");
    expect(body).not.toMatch(/attempt_id|submission_id|created_at|email|ip_address/i);
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "spec_test.pilot_export" }));
  });
});
