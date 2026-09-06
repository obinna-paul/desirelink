jest.mock("@/lib/prisma", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    profile: { findUnique: jest.fn(), update: jest.fn() },
    walletWithdrawal: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((operations: Promise<unknown>[]) => Promise.all(operations));
  return { prisma };
});
jest.mock("@/lib/email/wallet-notifications", () => ({
  sendPayoutRequestedEmail: jest.fn(),
  sendPayoutCompletedEmail: jest.fn(),
  sendPayoutFailedEmail: jest.fn(),
}));
jest.mock("@/lib/admin/audit", () => ({ recordAdminAction: jest.fn() }));

import {
  creditProviderWallet,
  MINIMUM_WITHDRAWAL_CENTS,
  withdrawWalletBalance,
} from "@/lib/wallet";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.Mock; update: jest.Mock };
  walletWithdrawal: { create: jest.Mock };
};

describe("creator wallet rules", () => {
  beforeEach(() => jest.clearAllMocks());

  it("credits exactly 85% of subscription or gift gross value", async () => {
    await creditProviderWallet("creator-1", 1_000_000);

    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: "creator-1" },
      data: { walletBalanceCents: { increment: 850_000 } },
    });
  });

  it("sets the minimum withdrawal to exactly ₦15,000", () => {
    expect(MINIMUM_WITHDRAWAL_CENTS).toBe(1_500_000);
  });

  it("rejects even one kobo below the ₦15,000 minimum", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      walletBalanceCents: 1_499_999,
      payoutRecipientCode: "RCP_ready",
      payoutSetupStatus: "verified",
      displayName: "Creator",
    });

    const result = await withdrawWalletBalance("creator-1");

    expect(result).toEqual({ ok: false, status: 400, error: "Minimum withdrawal is ₦15000.00." });
    expect(mockPrisma.walletWithdrawal.create).not.toHaveBeenCalled();
  });

  it("allows a withdrawal at exactly ₦15,000 with no second platform fee", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      walletBalanceCents: 1_500_000,
      payoutRecipientCode: "RCP_ready",
      payoutSetupStatus: "verified",
      displayName: "Creator",
    });
    mockPrisma.profile.update.mockResolvedValue({});
    mockPrisma.walletWithdrawal.create.mockResolvedValue({ id: "withdrawal-1" });

    const result = await withdrawWalletBalance("creator-1");

    expect(result).toEqual({
      ok: true,
      status: "pending",
      amountCents: 1_500_000,
      feeCents: 0,
      netAmountCents: 1_500_000,
    });
  });
});
