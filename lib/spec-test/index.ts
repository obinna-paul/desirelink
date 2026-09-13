/**
 * Public surface of the Spec Test module. Re-exports the v1 (legacy) engine so every
 * existing `@/lib/spec-test` import (signup, auth, admin, email) keeps resolving unchanged
 * after the v1 file was split into this directory - see docs/spec-test-v2-implementation-plan.md
 * §4 "Target module layout".
 *
 * v2 additions (taxonomy, items, scoring) are exported alongside but are not yet wired into
 * any route or UI - see the plan's phase sequencing. This file pulls in legacy.ts, which is
 * server-only, so nothing reached via "@/lib/spec-test" is client-safe - client code must
 * import the client-safe modules directly (@/lib/spec-test/items, @/lib/spec-test/taxonomy,
 * @/lib/spec-test/legacy-questions).
 */
export * from "@/lib/spec-test/legacy";
export * from "@/lib/spec-test/taxonomy";
export * from "@/lib/spec-test/response";
export type { SpecItemV2, SpecItemOptionV2 } from "@/lib/spec-test/items/spec-v2";
export { SPEC_TEST_ITEMS_V2, itemBankForVersion } from "@/lib/spec-test/items";
export { decideSpecTestResult, type SpecTestDecision } from "@/lib/spec-test/scoring/decide";
export { assessResponseQuality, SKIP_CAP, type QualityFlag } from "@/lib/spec-test/scoring/quality";
export { composeSpecTestResult, type ComposeInput, type SpecTestResultCopy } from "@/lib/spec-test/interpretation/compose";
export { ARCHETYPE_READINGS_V2, type ArchetypeReadingV2 } from "@/lib/spec-test/interpretation/readings-v2";
export { evaluatePatternFlags, patternFlagIds, type PatternFlagId, type TriggeredPatternFlag } from "@/lib/spec-test/interpretation/pattern-flags";
export { getSpecTestReading, type SpecTestReading, type SpecTestReadingV1, type SpecTestReadingV2 } from "@/lib/spec-test/results";
export {
  getSpecTestTypeDistribution,
  getSpecTestConfidenceMix,
  type SpecTypeDistributionRow,
  type ConfidenceMix,
} from "@/lib/spec-test/admin-stats";
