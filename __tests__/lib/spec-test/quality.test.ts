import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { assessResponseQuality, SKIP_CAP } from "@/lib/spec-test/scoring/quality";
import { TENSION_ITEM_PAIRS } from "@/lib/spec-test/scoring/loadings";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";

function itemById(itemId: string) {
  const item = SPEC_TEST_ITEMS_V2.find((i) => i.id === itemId);
  if (!item) throw new Error(`unknown item ${itemId}`);
  return item;
}

function answered(itemId: string, suffix: "a" | "b" | "c" | "d", opts: { elapsedMs?: number; presentedIndex?: number } = {}): SpecTestResponseV2 {
  const item = itemById(itemId);
  const optionIndex = ["a", "b", "c", "d"].indexOf(suffix);
  return {
    itemId,
    optionId: item.options[optionIndex].id,
    presentedIndex: opts.presentedIndex ?? optionIndex,
    elapsedMs: opts.elapsedMs ?? 3000,
  };
}

function skipped(itemId: string): SpecTestResponseV2 {
  return { itemId, optionId: null, presentedIndex: null, elapsedMs: 0, skipped: true };
}

/** A clean full response set with no quality issues - varied timing and varied on-screen
 *  position so neither the speed nor straight-line detector fires. */
function cleanResponses(): SpecTestResponseV2[] {
  return SPEC_TEST_ITEMS_V2.map((item, index) => answered(item.id, (["a", "b", "c", "d"] as const)[index % 4], { elapsedMs: 2500 + index * 40 }));
}

describe("response quality gating", () => {
  it("is usable for a clean, varied, fully-answered response set", () => {
    const result = assessResponseQuality(SPEC_TEST_ITEMS_V2, cleanResponses());
    expect(result.quality).toBe("usable");
    expect(result.flags).toEqual([]);
  });

  it("flags excessive_skips only once the skip count exceeds the cap", () => {
    const responses = cleanResponses();

    const atCap = responses.map((r, i) => (i < SKIP_CAP ? skipped(r.itemId) : r));
    expect(assessResponseQuality(SPEC_TEST_ITEMS_V2, atCap).flags).not.toContain("excessive_skips");

    const overCap = responses.map((r, i) => (i < SKIP_CAP + 1 ? skipped(r.itemId) : r));
    const overResult = assessResponseQuality(SPEC_TEST_ITEMS_V2, overCap);
    expect(overResult.flags).toContain("excessive_skips");
    expect(overResult.quality).toBe("low_signal");
  });

  it("flags too_fast when several items are answered faster than a person could read them", () => {
    const responses = cleanResponses().map((r, i) => (i < 6 ? { ...r, elapsedMs: 150 } : r));
    const result = assessResponseQuality(SPEC_TEST_ITEMS_V2, responses);
    expect(result.flags).toContain("too_fast");
    expect(result.quality).toBe("low_signal");
  });

  it("does not flag too_fast for one fast tap among otherwise varied timing", () => {
    const responses = cleanResponses().map((r, i) => (i === 0 ? { ...r, elapsedMs: 150 } : r));
    const result = assessResponseQuality(SPEC_TEST_ITEMS_V2, responses);
    expect(result.flags).not.toContain("too_fast");
  });

  it("flags straight_line when almost every answer sits in the same on-screen position", () => {
    const responses = SPEC_TEST_ITEMS_V2.map((item) => answered(item.id, "a", { presentedIndex: 0 }));
    const result = assessResponseQuality(SPEC_TEST_ITEMS_V2, responses);
    expect(result.flags).toContain("straight_line");
    expect(result.quality).toBe("low_signal");
  });

  it("flags contradiction only when every tension pair swings to an opposed dimension", () => {
    expect(TENSION_ITEM_PAIRS.length).toBeGreaterThanOrEqual(2);

    // compliment-deepest-b [A] vs friend-introduction-b [W]; attractive-life-a [A] vs
    // lasting-partnership-a [W] - both pairs opposed on the agency/warmth axis.
    const responses = cleanResponses().map((r) => {
      if (r.itemId === "compliment-deepest") return answered("compliment-deepest", "b");
      if (r.itemId === "friend-introduction") return answered("friend-introduction", "b");
      if (r.itemId === "attractive-life") return answered("attractive-life", "a");
      if (r.itemId === "lasting-partnership") return answered("lasting-partnership", "a");
      return r;
    });
    const result = assessResponseQuality(SPEC_TEST_ITEMS_V2, responses);
    expect(result.flags).toContain("contradiction");
    expect(result.quality).toBe("low_signal");
  });

  it("keeps contradiction as a non-blocking diagnostic for spec-v2.2", () => {
    const responses = cleanResponses().map((r) => {
      if (r.itemId === "compliment-deepest") return answered("compliment-deepest", "b");
      if (r.itemId === "friend-introduction") return answered("friend-introduction", "b");
      if (r.itemId === "attractive-life") return answered("attractive-life", "a");
      if (r.itemId === "lasting-partnership") return answered("lasting-partnership", "a");
      return r;
    });
    const result = assessResponseQuality(SPEC_TEST_ITEMS_V2, responses, {
      contradictionMode: "diagnostic",
    });
    expect(result.flags).toContain("contradiction");
    expect(result.quality).toBe("usable");
  });

  it("does not flag contradiction when only one tension pair is opposed", () => {
    const responses = cleanResponses().map((r) => {
      if (r.itemId === "compliment-deepest") return answered("compliment-deepest", "b");
      if (r.itemId === "friend-introduction") return answered("friend-introduction", "b");
      return r;
    });
    const result = assessResponseQuality(SPEC_TEST_ITEMS_V2, responses);
    expect(result.flags).not.toContain("contradiction");
  });
});
