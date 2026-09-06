import { getTierDiscountPercent } from "@/lib/tier-pricing";
import { creatorTierSchema, findTierRankConflict } from "@/lib/validations/creator-tier";

const validTier = {
  name: "Members",
  description: "Premium posts",
  priceNaira: 6_000,
  tierType: "beginner" as const,
  maxSubscribers: null,
  isLimited: false,
};

describe("creatorTierSchema", () => {
  it("keeps the original price optional for existing clients", () => {
    const parsed = creatorTierSchema.parse(validTier);
    expect(parsed.compareAtPriceNaira).toBeNull();
  });

  it("accepts an original price above the price subscribers pay", () => {
    const result = creatorTierSchema.safeParse({
      ...validTier,
      compareAtPriceNaira: 10_000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a false comparison price", () => {
    const result = creatorTierSchema.safeParse({
      ...validTier,
      compareAtPriceNaira: 5_000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["compareAtPriceNaira"]);
    }
  });
});

describe("getTierDiscountPercent", () => {
  it("calculates the rounded discount from the stored prices", () => {
    expect(getTierDiscountPercent(600_000, 1_000_000)).toBe(40);
  });

  it("does not show a discount without a valid higher comparison price", () => {
    expect(getTierDiscountPercent(600_000, null)).toBeNull();
    expect(getTierDiscountPercent(600_000, 600_000)).toBeNull();
  });
});

describe("findTierRankConflict", () => {
  it("allows a tier priced consistently with its rank against the creator's other tiers", () => {
    const conflict = findTierRankConflict(
      { tierType: "premium", priceCents: 1_050_000 },
      [
        { name: "Starter", tierType: "beginner", priceCents: 750_000 },
        { name: "VIP", tierType: "inner_circle", priceCents: 1_500_000 },
      ],
    );
    expect(conflict).toBeNull();
  });

  it("rejects a higher-ranked tier priced below a lower-ranked one", () => {
    const conflict = findTierRankConflict(
      { tierType: "inner_circle", priceCents: 500_000 },
      [{ name: "Starter", tierType: "beginner", priceCents: 750_000 }],
    );
    expect(conflict).not.toBeNull();
  });

  it("rejects a lower-ranked tier priced above a higher-ranked one", () => {
    const conflict = findTierRankConflict(
      { tierType: "beginner", priceCents: 2_000_000 },
      [{ name: "VIP", tierType: "inner_circle", priceCents: 1_500_000 }],
    );
    expect(conflict).not.toBeNull();
  });

  it("never conflicts with another tier of the same type", () => {
    const conflict = findTierRankConflict(
      { tierType: "beginner", priceCents: 2_000_000 },
      [{ name: "Basic", tierType: "beginner", priceCents: 500_000 }],
    );
    expect(conflict).toBeNull();
  });

  it("allows equal prices between adjacent ranks", () => {
    const conflict = findTierRankConflict(
      { tierType: "premium", priceCents: 750_000 },
      [{ name: "Starter", tierType: "beginner", priceCents: 750_000 }],
    );
    expect(conflict).toBeNull();
  });
});
