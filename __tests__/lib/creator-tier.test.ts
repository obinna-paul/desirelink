import { findTierRankConflict } from "@/lib/validations/creator-tier";

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
