// Client-safe. Names, ids and the version tag for the v2 instrument - no scoring weights,
// no centroids, no item content. See docs/spec-test-research.md §3 (Layers A-D) and
// docs/spec-test-v2-implementation-plan.md §2 principle 1: this is versioned CONFIG, not
// code - the report treats 7 motives and 8 archetypes as hypotheses the pilot may revise,
// so nothing downstream may assume these lists' length or order.

export const INSTRUMENT_VERSION = "spec-v2.0" as const;

/**
 * The seven candidate attraction motives (report §3 Layer A), with the "I" (Intrigue &
 * Selective Access) motive represented here by its combined key - see MOTIVE_FACET_KEYS
 * below for its two candidate facets, which are scored and matched separately throughout
 * the engine per the report's explicit instruction to keep them apart until pilot data
 * decides whether they belong together.
 */
export const MOTIVE_KEYS = [
  "warmthResponsiveness",
  "reliabilityReciprocity",
  "socialVitality",
  "agencyDirection",
  "cognitivePlay",
  "noveltyAutonomy",
  "intrigueSelectiveAccess",
] as const;

export type MotiveKey = (typeof MOTIVE_KEYS)[number];

export const MOTIVE_LABELS: Record<MotiveKey, string> = {
  warmthResponsiveness: "Warmth & Responsiveness",
  reliabilityReciprocity: "Reliability & Reciprocity",
  socialVitality: "Social & Embodied Vitality",
  agencyDirection: "Agency & Direction",
  cognitivePlay: "Cognitive Play",
  noveltyAutonomy: "Novelty & Autonomy",
  intrigueSelectiveAccess: "Intrigue & Selective Access",
} as const;

/** The two candidate facets of the "I" motive (report §3 Layer A, §Layer A footnote). */
export const MOTIVE_FACET_KEYS = ["containedDepthPrivacy", "aestheticSelectivity"] as const;

export type MotiveFacetKey = (typeof MOTIVE_FACET_KEYS)[number];

export const MOTIVE_FACET_LABELS: Record<MotiveFacetKey, string> = {
  containedDepthPrivacy: "Contained Depth / Privacy",
  aestheticSelectivity: "Aesthetic Selectivity",
} as const;

/**
 * The internal scoring space combines the six non-intrigue motives with the two intrigue
 * facets kept separate (8 dimensions total) - see lib/spec-test/scoring/score.ts. The
 * combined `intrigueSelectiveAccess` motive score (as in the report's §11 JSON schema) is
 * derived from the two facets rather than scored independently.
 */
export const SCORING_DIMENSION_KEYS = [
  "warmthResponsiveness",
  "reliabilityReciprocity",
  "socialVitality",
  "agencyDirection",
  "cognitivePlay",
  "noveltyAutonomy",
  "containedDepthPrivacy",
  "aestheticSelectivity",
] as const;

export type ScoringDimensionKey = (typeof SCORING_DIMENSION_KEYS)[number];

/** The eight interpretive lenses (report §3 Layer B). Each is a signed axis; the label
 *  pair documents which pole is 0 and which is 100. */
export const LENS_KEYS = [
  "sparkSafety",
  "closenessAutonomy",
  "fastSlow",
  "directnessIntrigue",
  "privatePublic",
  "admirationMutuality",
  "mindEmbodied",
  "explorationCommitment",
] as const;

export type LensKey = (typeof LENS_KEYS)[number];

export const LENS_POLES: Record<LensKey, { low: string; high: string }> = {
  sparkSafety: { low: "Safety", high: "Spark" },
  closenessAutonomy: { low: "Closeness", high: "Autonomy" },
  fastSlow: { low: "Slow burn", high: "Fast burn" },
  directnessIntrigue: { low: "Directness", high: "Intrigue" },
  privatePublic: { low: "Private", high: "Public" },
  admirationMutuality: { low: "Mutuality", high: "Admiration" },
  mindEmbodied: { low: "Embodied energy", high: "Mind" },
  explorationCommitment: { low: "Commitment", high: "Exploration" },
} as const;

/** The attachment-response lens (report §3 Layer C) is reported as ordinary language, never
 *  as a diagnosis - these are the only four labels the product may show. */
export const ATTACHMENT_RESPONSE_LABELS = [
  "steadyUnderUncertainty",
  "reassuranceSensitive",
  "spaceProtective",
  "pushPull",
] as const;

export type AttachmentResponseLabel = (typeof ATTACHMENT_RESPONSE_LABELS)[number];

export const ATTACHMENT_RESPONSE_COPY: Record<AttachmentResponseLabel, string> = {
  steadyUnderUncertainty: "Steady under uncertainty",
  reassuranceSensitive: "Reassurance-sensitive",
  spaceProtective: "Space-protective",
  pushPull: "Push-pull",
} as const;

/** The eight provisional archetypes (report §3 Layer A2, §4). Kept as the same keys the v1
 *  instrument used so admin data and copy can carry over, but the set itself is config: the
 *  report is explicit that it may be merged, split or renamed after pilot data comes in
 *  (docs/spec-test-v2-implementation-plan.md open decision D-2). */
export const ARCHETYPE_KEYS = [
  "quiet_fire",
  "soft_landing",
  "electric_charmer",
  "ambitious_icon",
  "brilliant_tease",
  "beautiful_mystery",
  "free_spirit",
  "grounded_equal",
] as const;

export type ArchetypeKey = (typeof ARCHETYPE_KEYS)[number];

/** Item sections (report §5) and their score weights. */
export const SECTION_KEYS = ["spark", "pattern", "partnership"] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_WEIGHTS: Record<SectionKey, number> = {
  spark: 1.25,
  pattern: 1.0,
  partnership: 1.15,
} as const;

/** Result confidence labels (report §6.2). No fallback: "low_signal" is a first-class
 *  outcome, never silently converted into an archetype. */
export const RESULT_CONFIDENCE_LEVELS = ["clear", "blend", "split", "low_signal"] as const;

export type ResultConfidence = (typeof RESULT_CONFIDENCE_LEVELS)[number];

export const RESPONSE_QUALITY_LEVELS = ["usable", "low_signal"] as const;

export type ResponseQuality = (typeof RESPONSE_QUALITY_LEVELS)[number];

export type OptionKey = "A" | "B" | "C" | "D";
