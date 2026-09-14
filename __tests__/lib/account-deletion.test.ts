jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), delete: jest.fn() },
    verificationRequest: { findMany: jest.fn() },
    report: { updateMany: jest.fn() },
  },
}));
jest.mock("@/lib/verification", () => ({ deleteVerificationMedia: jest.fn() }));

import { deleteOwnAccount } from "@/lib/account-deletion";
import { prisma } from "@/lib/prisma";
import { deleteVerificationMedia } from "@/lib/verification";

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; delete: jest.Mock };
  verificationRequest: { findMany: jest.Mock };
  report: { updateMany: jest.Mock };
};

describe("deleteOwnAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.verificationRequest.findMany.mockResolvedValue([]);
    mockPrisma.report.updateMany.mockResolvedValue({ count: 0 });
  });

  it("404s when the account doesn't exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await deleteOwnAccount("user-1");

    expect(result).toEqual({ ok: false, status: 404, error: "Account not found" });
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete an admin account", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: true, profile: { id: "profile-1" } });

    const result = await deleteOwnAccount("user-1");

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it("purges unpurged verification media before deleting", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: false, profile: { id: "profile-1" } });
    mockPrisma.verificationRequest.findMany.mockResolvedValue([
      { id: "req-1", govIdUrl: "a", selfieUrl: "b" },
    ]);

    const result = await deleteOwnAccount("user-1");

    expect(deleteVerificationMedia).toHaveBeenCalledWith({ id: "req-1", govIdUrl: "a", selfieUrl: "b" });
    expect(result).toEqual({ ok: true });
  });

  it("unsets reportedUserId and deletes the user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: false, profile: { id: "profile-1" } });

    const result = await deleteOwnAccount("user-1");

    expect(mockPrisma.report.updateMany).toHaveBeenCalledWith({
      where: { reportedUserId: "profile-1" },
      data: { reportedUserId: null },
    });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(result).toEqual({ ok: true });
  });

  it("skips profile-scoped cleanup for a user with no profile row", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: false, profile: null });

    const result = await deleteOwnAccount("user-1");

    expect(mockPrisma.verificationRequest.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.report.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(result).toEqual({ ok: true });
  });

  it("returns a 409 when the delete fails (e.g. blocking foreign-key history)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: false, profile: { id: "profile-1" } });
    mockPrisma.user.delete.mockRejectedValue(new Error("FK constraint"));

    const result = await deleteOwnAccount("user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
    }
  });
});
