import { SPEC_COMPATIBILITY, specCompatibilityWeight } from "@/lib/spec-test/compatibility";
import { ARCHETYPE_KEYS } from "@/lib/spec-test/taxonomy";

describe("specCompatibilityWeight", () => {
  it("is 0 whenever either side hasn't taken the test - never a penalty, only never a boost", () => {
    expect(specCompatibilityWeight(null, "soft_landing")).toBe(0);
    expect(specCompatibilityWeight("soft_landing", null)).toBe(0);
    expect(specCompatibilityWeight(undefined, undefined)).toBe(0);
  });

  it("gives a smaller, flat credit for sharing the viewer's own spec", () => {
    expect(specCompatibilityWeight("soft_landing", "soft_landing")).toBe(0.3);
  });

  it("weights the first-listed complement at full strength, tapering for later ones", () => {
    const [first, second] = SPEC_COMPATIBILITY.grounded_equal;
    expect(specCompatibilityWeight("grounded_equal", first)).toBe(1);
    expect(specCompatibilityWeight("grounded_equal", second)).toBe(0.75);
  });

  it("is 0 for a pairing that isn't the viewer's own spec and isn't in their complement list", () => {
    // ambitious_icon's own list is [grounded_equal, ambitious_icon] - brilliant_tease is in
    // neither position, so it should score 0, not fall through to some default credit.
    expect(SPEC_COMPATIBILITY.ambitious_icon).not.toContain("brilliant_tease");
    expect(specCompatibilityWeight("ambitious_icon", "brilliant_tease")).toBe(0);
  });

  it("every archetype has a non-empty, self-consistent complement list", () => {
    for (const key of ARCHETYPE_KEYS) {
      expect(SPEC_COMPATIBILITY[key].length).toBeGreaterThan(0);
      for (const complement of SPEC_COMPATIBILITY[key]) {
        expect(ARCHETYPE_KEYS).toContain(complement);
      }
    }
  });
});
