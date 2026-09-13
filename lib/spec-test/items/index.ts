// Client-safe. Version -> item bank lookup, so the quiz wizard and the submit route both
// resolve "which items belong to this instrumentVersion" from one place.
import { INSTRUMENT_VERSION } from "@/lib/spec-test/taxonomy";
import { SPEC_TEST_ITEMS_V2, type SpecItemV2 } from "@/lib/spec-test/items/spec-v2";

export type { SpecItemV2, SpecItemOptionV2 } from "@/lib/spec-test/items/spec-v2";

const ITEM_BANKS: Record<string, SpecItemV2[]> = {
  [INSTRUMENT_VERSION]: SPEC_TEST_ITEMS_V2,
};

export function itemBankForVersion(version: string): SpecItemV2[] | undefined {
  return ITEM_BANKS[version];
}

export { SPEC_TEST_ITEMS_V2, INSTRUMENT_VERSION };
