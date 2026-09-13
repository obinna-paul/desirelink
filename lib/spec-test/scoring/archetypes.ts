import "server-only";

// server-only. Numeric centroids for the eight provisional archetypes, authored by hand from
// docs/spec-test-research.md §3 "Layer A2: archetypes as motive combinations" and the fuller
// per-archetype readings in §4 - the report gives these only as qualitative shapes ("high
// I-depth, moderate W/C, low public V"), never as numbers, so every value below has to be
// authored and is traceable to a specific descriptor rather than invented freehand. See
// docs/spec-test-v2-implementation-plan.md §6 "The centroid-authoring problem".
//
// Word -> number mapping used throughout (documented once here, not re-derived per value):
//   high = 80, moderate-high = 65, moderate = 50 (also the default for an unmentioned
//   dimension), low = 30.
//
// These are a starting hypothesis, not a finding. alpha/sigma/tau are provisional constants
// to be replaced by pilot-observed values per report §6.4 - see the refit path in the
// implementation plan §12. Any change to the numbers below must be logged in
// docs/spec-test-instrument-changelog.md (plan §14).

import { ARCHETYPE_KEYS, SCORING_DIMENSION_KEYS, type ArchetypeKey, type ScoringDimensionKey } from "@/lib/spec-test/taxonomy";

export type ScoringVector = Record<ScoringDimensionKey, number>;

const H = 80; // high
const MH = 65; // moderate-high
const M = 50; // moderate / unmentioned-dimension default
const L = 30; // low

function vector(overrides: Partial<ScoringVector>): ScoringVector {
  const base = Object.fromEntries(SCORING_DIMENSION_KEYS.map((key) => [key, M])) as ScoringVector;
  return { ...base, ...overrides };
}

/**
 * Each centroid's non-default values are commented with the report language they come from.
 * "I" (Intrigue & Selective Access) is represented by its two facets, containedDepthPrivacy
 * and aestheticSelectivity, kept separate per taxonomy.ts - this is what lets Quiet Fire
 * (depth-driven intrigue) and Beautiful Mystery (aesthetic-driven intrigue) resolve as
 * distinct archetypes despite both scoring high on "I" in the report's own framing.
 */
export const ARCHETYPE_CENTROIDS: Record<ArchetypeKey, ScoringVector> = {
  // "high I-depth, moderate W/C, low public V" (§3 Layer A2)
  quiet_fire: vector({
    containedDepthPrivacy: H,
    warmthResponsiveness: M,
    cognitivePlay: MH,
    socialVitality: L,
  }),

  // "high W, moderate R, low tolerance for ambiguity" (§3 Layer A2) - low ambiguity
  // tolerance reads as low intrigue on both facets, not merely low I-depth.
  soft_landing: vector({
    warmthResponsiveness: H,
    reliabilityReciprocity: MH,
    containedDepthPrivacy: L,
    aestheticSelectivity: L,
    socialVitality: L,
  }),

  // "high V, often C, fast spark" (§3 Layer A2)
  electric_charmer: vector({
    socialVitality: H,
    cognitivePlay: MH,
    noveltyAutonomy: MH,
    containedDepthPrivacy: L,
  }),

  // "high A, often R or V depending on subtype" (§3 Layer A2) - R taken as the primary
  // secondary per §4.4's emphasis on partnership and standards over social vitality.
  ambitious_icon: vector({
    agencyDirection: H,
    reliabilityReciprocity: MH,
  }),

  // "high C, often V or I-depth" (§3 Layer A2) - V taken as the secondary per §4.5's framing
  // of wit as a social/verbal performance rather than a private one.
  brilliant_tease: vector({
    cognitivePlay: H,
    socialVitality: MH,
    containedDepthPrivacy: MH,
  }),

  // "high I-aesthetic, often A, selective/slow reveal" (§3 Layer A2)
  beautiful_mystery: vector({
    aestheticSelectivity: H,
    agencyDirection: MH,
    socialVitality: L,
    noveltyAutonomy: L,
  }),

  // "high N, often V, strong autonomy" (§3 Layer A2)
  free_spirit: vector({
    noveltyAutonomy: H,
    socialVitality: MH,
    reliabilityReciprocity: L,
  }),

  // "high R and W, strong mutuality" (§3 Layer A2)
  grounded_equal: vector({
    reliabilityReciprocity: H,
    warmthResponsiveness: MH,
    socialVitality: L,
    noveltyAutonomy: L,
    containedDepthPrivacy: L,
    aestheticSelectivity: L,
  }),
};

/** Per-dimension weight in the centroid distance calculation. Uniform until pilot data
 *  justifies privileging any one motive (report §6.1: "set by expert review and then
 *  estimated from pilot data, not invented permanently at launch"). */
export const ALPHA: ScoringVector = Object.fromEntries(SCORING_DIMENSION_KEYS.map((key) => [key, 1])) as ScoringVector;

/** Per-dimension standard deviation used to scale distance. Uniform placeholder - report
 *  §6.4 replaces this with the observed per-motive spread once pilot data exists. 20 points
 *  on a 0-100 scale is roughly the gap between adjacent rungs of the H/MH/M/L/VL ladder
 *  above, so no single dimension dominates the distance purely from that ladder's spacing. */
export const SIGMA: ScoringVector = Object.fromEntries(SCORING_DIMENSION_KEYS.map((key) => [key, 20])) as ScoringVector;

/** Softmax temperature (report §6.1). Governs how decisive results look; tuned against the
 *  blend rate, not against any notion of "correctness" (report: "Start conservatively and
 *  tune it against validation data"). 15 is a starting value pending pilot tuning - see
 *  docs/spec-test-v2-implementation-plan.md §6. */
export const TAU = 15;

export function archetypeKeys(): ArchetypeKey[] {
  return [...ARCHETYPE_KEYS];
}
