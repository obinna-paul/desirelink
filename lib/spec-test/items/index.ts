// Client-safe. Version -> item bank lookup, so the quiz wizard and the submit route both
// resolve "which items belong to this instrumentVersion" from one place.
import { INSTRUMENT_VERSION, LEGACY_INSTRUMENT_VERSION_V2_0 } from "@/lib/spec-test/taxonomy";
import { SPEC_TEST_ITEMS_V2, type SpecItemV2 } from "@/lib/spec-test/items/spec-v2";

export type { SpecItemV2, SpecItemOptionV2 } from "@/lib/spec-test/items/spec-v2";
export { SPEC_TEST_CONTEXT_QUESTIONS_V2, type ContextQuestionV2, type ContextQuestionOption } from "@/lib/spec-test/items/context-v2";

// "spec-v2.0" resolves to the same bank as the current version - option ids, loadings and
// centroids never changed in the G1/G2 gender pass (only rendered text did), so any
// pre-gender row or fixture tagged with the old version string still validates (plan §8 DG-3).
const ITEM_BANKS: Record<string, SpecItemV2[]> = {
  [INSTRUMENT_VERSION]: SPEC_TEST_ITEMS_V2,
  [LEGACY_INSTRUMENT_VERSION_V2_0]: SPEC_TEST_ITEMS_V2,
};

export function itemBankForVersion(version: string): SpecItemV2[] | undefined {
  return ITEM_BANKS[version];
}

export { SPEC_TEST_ITEMS_V2, INSTRUMENT_VERSION };
