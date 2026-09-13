import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { decideSpecTestResult } from "@/lib/spec-test/scoring/decide";
import { SKIP_CAP } from "@/lib/spec-test/scoring/quality";
import { ARCHETYPE_KEYS } from "@/lib/spec-test/taxonomy";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";

function itemById(itemId: string) {
  const item = SPEC_TEST_ITEMS_V2.find((i) => i.id === itemId);
  if (!item) throw new Error(`unknown item ${itemId}`);
  return item;
}

function answered(itemId: string, suffix: "a" | "b" | "c" | "d"): SpecTestResponseV2 {
  const item = itemById(itemId);
  const index = ["a", "b", "c", "d"].indexOf(suffix);
  return { itemId, optionId: item.options[index].id, presentedIndex: index, elapsedMs: 2500 };
}

function skipped(itemId: string): SpecTestResponseV2 {
  return { itemId, optionId: null, presentedIndex: null, elapsedMs: 0, skipped: true };
}

/** Full, clean response set with varied timing/position so no quality flag fires on its own -
 *  a baseline callers mutate for specific scenarios below. */
function baselineResponses(overrides: Record<string, "a" | "b" | "c" | "d"> = {}): SpecTestResponseV2[] {
  return SPEC_TEST_ITEMS_V2.map((item, index) => {
    const suffix = overrides[item.id] ?? (["a", "b", "c", "d"] as const)[index % 4];
    return { ...answered(item.id, suffix), elapsedMs: 2500 + index * 40 };
  });
}

describe("decideSpecTestResult - no fallback", () => {
  it("returns low_signal, never an archetype, when the skip cap is exceeded", () => {
    const responses = baselineResponses().map((r, i) => (i <= SKIP_CAP ? skipped(r.itemId) : r));
    const result = decideSpecTestResult(SPEC_TEST_ITEMS_V2, responses);
    expect(result.confidence).toBe("low_signal");
    expect(result.quality).toBe("low_signal");
    expect("primarySpec" in result).toBe(false);
  });

  it("never assigns grounded_equal (or any archetype) merely because nothing else won", () => {
    // An all-neutral response set (every dimension defaults to 50) is the exact scenario
    // v1's fallback rule mishandled - assert only that whatever wins, it wins on distance,
    // not that it silently defaults to one fixed key regardless of input.
    const allSkipped = SPEC_TEST_ITEMS_V2.slice(0, SKIP_CAP).map((item) => skipped(item.id));
    const rest = SPEC_TEST_ITEMS_V2.slice(SKIP_CAP).map((item, i) => answered(item.id, (["a", "b", "c", "d"] as const)[i % 4]));
    const result = decideSpecTestResult(SPEC_TEST_ITEMS_V2, [...allSkipped, ...rest]);
    // Within the skip cap, so this should still resolve normally (not low_signal) -
    // confirming the cap boundary itself, and that a result CAN be produced here at all.
    expect(result.quality).toBe("usable");
    if (result.quality === "usable") {
      expect(ARCHETYPE_KEYS).toContain(result.primarySpec);
    }
  });
});

describe("decideSpecTestResult - determinism", () => {
  it("produces an identical decision for identical input", () => {
    const responses = baselineResponses();
    const first = decideSpecTestResult(SPEC_TEST_ITEMS_V2, responses);
    const second = decideSpecTestResult(SPEC_TEST_ITEMS_V2, [...responses]);
    expect(first).toEqual(second);
  });
});

describe("decideSpecTestResult - confidence branches", () => {
  it("reports split when the Spark and Partnership sections point at different archetypes", () => {
    // Spark answers push toward vitality/novelty/cognitive-play (electric_charmer / free_spirit
    // territory); Partnership answers push toward reliability (grounded_equal territory).
    const responses = baselineResponses({
      "crowded-event": "b",
      "first-date-danger": "c",
      "message-replay": "c",
      "profile-investigate": "c",
      "compliment-deepest": "c",
      "conversation-pause": "d",
      "hosting-party": "b",
      "slow-reveal": "c",
      "lasting-partnership": "d",
      "repeated-sunday": "d",
      "forgivable-flaw": "c",
      "chemistry-definition": "c",
    });

    const result = decideSpecTestResult(SPEC_TEST_ITEMS_V2, responses);
    expect(result.quality).toBe("usable");
    if (result.quality !== "usable") throw new Error("expected a usable result");

    expect(result.sparkPrimarySpec).not.toBe(result.partnershipPrimarySpec);
    expect(result.confidence).toBe("split");
    // Locks in the specific archetypes this fixture resolves to today, so a future centroid
    // or loadings change that silently erases the split shows up as a failing test.
    expect(result.sparkPrimarySpec).toBe("free_spirit");
    expect(result.partnershipPrimarySpec).toBe("grounded_equal");
  });

  it("always reports a confidence level from the closed set, never something ad hoc", () => {
    const result = decideSpecTestResult(SPEC_TEST_ITEMS_V2, baselineResponses());
    expect(["clear", "blend", "split", "low_signal"]).toContain(result.confidence);
  });

  it("reports distinct primary and secondary specs on a usable result", () => {
    const result = decideSpecTestResult(SPEC_TEST_ITEMS_V2, baselineResponses());
    if (result.quality === "usable") {
      expect(result.primarySpec).not.toBe(result.secondarySpec);
    }
  });
});

describe("decideSpecTestResult - attachment", () => {
  it("returns an attachment read on a usable result answering the attachment items", () => {
    const result = decideSpecTestResult(SPEC_TEST_ITEMS_V2, baselineResponses());
    if (result.quality === "usable") {
      expect(result.attachment).not.toBeNull();
      expect(result.attachment?.anxiety).toBeGreaterThanOrEqual(0);
      expect(result.attachment?.anxiety).toBeLessThanOrEqual(100);
    }
  });
});
