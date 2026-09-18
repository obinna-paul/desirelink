// Client-safe. Version -> item bank lookup, so the quiz wizard and the submit route both
// resolve "which items belong to this instrumentVersion" from one place.
import {
  INSTRUMENT_VERSION,
  LEGACY_INSTRUMENT_VERSION_V2_0,
  LEGACY_INSTRUMENT_VERSION_V2_1,
} from "@/lib/spec-test/taxonomy";
import { SPEC_TEST_ITEMS_V2, type SpecItemV2 } from "@/lib/spec-test/items/spec-v2";

export type { SpecItemV2, SpecItemOptionV2 } from "@/lib/spec-test/items/spec-v2";
export {
  SPEC_TEST_ITEMS_V3_PILOT,
  V3_PILOT_BEST_WORST_ITEMS,
  V3_PILOT_INTENSITY_ITEMS,
  V3_PILOT_UNCERTAINTY_ITEMS,
  V3_PILOT_INSTRUMENT_VERSION,
  type SpecItemV3Pilot,
  type BestWorstItemV3,
  type IntensityItemV3,
  type UncertaintyItemV3,
} from "@/lib/spec-test/items/spec-v3-pilot";
export { SPEC_TEST_CONTEXT_QUESTIONS_V2, type ContextQuestionV2, type ContextQuestionOption } from "@/lib/spec-test/items/context-v2";

// v2.0, v2.1 and v2.2 resolve to the same item ids. v2.1 changed gendered rendering; v2.2
// changed scoring semantics. The submit route validates against this bank and then routes by
// version to the matching classifier, so sharing a bank never means sharing a scoring model.
const ITEM_BANKS: Record<string, SpecItemV2[]> = {
  [INSTRUMENT_VERSION]: SPEC_TEST_ITEMS_V2,
  [LEGACY_INSTRUMENT_VERSION_V2_1]: SPEC_TEST_ITEMS_V2,
  [LEGACY_INSTRUMENT_VERSION_V2_0]: SPEC_TEST_ITEMS_V2,
};

export function itemBankForVersion(version: string): SpecItemV2[] | undefined {
  return ITEM_BANKS[version];
}

export { SPEC_TEST_ITEMS_V2, INSTRUMENT_VERSION };
