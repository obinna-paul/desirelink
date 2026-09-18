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
export {
  SPEC_TEST_ITEMS_V3_PILOT,
  V3_PILOT_INSTRUMENT_VERSION,
  type SpecItemV3Pilot,
} from "@/lib/spec-test/items/spec-v3-pilot";
export {
  analyzeV3PilotBank,
  scoreV3PilotAttraction,
  scoreV3PilotUncertainty,
  validateV3PilotResponses,
  type V3PilotAttractionProfile,
  type V3PilotBankDiagnostics,
} from "@/lib/spec-test/scoring/pilot-v3";
export {
  getSpecTestPilotAnalytics,
  type PilotFunnelPoint,
  type PilotItemAnalytics,
  type PilotMotiveDistribution,
  type SpecTestPilotAnalytics,
} from "@/lib/spec-test/pilot-analytics";
export {
  reviewSpecTestPilot,
  V3_PILOT_REVIEW_THRESHOLDS,
  type PilotReviewGate,
  type PilotReviewWarning,
  type SpecTestPilotReview,
} from "@/lib/spec-test/pilot-review";
export {
  decideSpecTestResult,
  decideSpecTestResultForVersion,
  decideSpecTestResultV22,
  type SpecTestDecision,
} from "@/lib/spec-test/scoring/decide";
export {
  analyzeScoreSpace,
  analyzeSingleAnswerPerturbations,
  buildScoringLaboratoryReport,
  searchArchetypeReachability,
  searchV22ArchetypeReachability,
  simulateNullDistribution,
  simulateV22NullDecisions,
  type ArchetypeReachabilityDiagnostic,
  type DecisionNullSimulationDiagnostics,
  type NullSimulationDiagnostics,
  type PerturbationDiagnostics,
  type ScoreSpaceDiagnostics,
  type ScoringHealthFlag,
  type ScoringLaboratoryReport,
} from "@/lib/spec-test/scoring/diagnostics";
export { assessResponseQuality, SKIP_CAP, type QualityFlag } from "@/lib/spec-test/scoring/quality";
export { composeSpecTestResult, type ComposeInput, type SpecTestResultCopy } from "@/lib/spec-test/interpretation/compose";
export { ARCHETYPE_READINGS_V2, type ArchetypeReadingV2 } from "@/lib/spec-test/interpretation/readings-v2";
export { evaluatePatternFlags, patternFlagIds, type PatternFlagId, type TriggeredPatternFlag } from "@/lib/spec-test/interpretation/pattern-flags";
export { getSpecTestReading, type SpecTestReading, type SpecTestReadingV1, type SpecTestReadingV2 } from "@/lib/spec-test/results";
export {
  getSpecTestTypeDistribution,
  getSpecTestConfidenceMix,
  getSpecTestConfidenceMixByForm,
  getSpecTestTypeDistributionByForm,
  type SpecTypeDistributionRow,
  type ConfidenceMix,
  type FormConfidenceMix,
  type FormTypeDistribution,
} from "@/lib/spec-test/admin-stats";
export {
  getSpecTestItemAnalytics,
  getSpecTestDataSplitCounts,
  type ItemAnalytics,
  type ItemOptionAnalytics,
  type DataSplitCounts,
} from "@/lib/spec-test/calibration";
// Gender routing/rendering (docs/spec-test-gender-implementation-plan.md Phase G1) is
// client-safe and re-exported here for server-side convenience only - client code (the quiz
// wizard) imports @/lib/spec-test/gender/* directly, same convention as items/taxonomy above,
// since this barrel pulls in legacy.ts and is therefore server-only overall.
export { GENDERS, QUIZ_FORMS, ROUTING_RULE, routeForm, type Gender, type QuizForm, type RoutingResult } from "@/lib/spec-test/gender/forms";
export { TOKEN_KEYS, TERM_TABLES, type TokenKey, type RenderForm } from "@/lib/spec-test/gender/terms";
export { renderTerms } from "@/lib/spec-test/gender/render";
