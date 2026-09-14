// Deliberately not server-only - lib/recommendations.ts and lib/ranking/people-scoring.ts
// both need this at request time for ordinary (non-server-only-gated) ranking code.

import type { ArchetypeKey } from "@/lib/spec-test/taxonomy";

/**
 * Which archetypes tend to work as a long-term match for a given one - directly traceable to
 * that archetype's own `longTermFit` paragraph in
 * lib/spec-test/interpretation/readings-v2.ts (each one already names its ideal complement in
 * prose; this just formalizes it into a ranked list). Ordered highest-fit first.
 *
 * Hand-authored, same interpretive-judgment-call status as the archetype centroids in
 * lib/spec-test/scoring/archetypes.ts - NOT derived from outcome data, because none exists
 * yet. Once enough users have a known spec and enough interactions between them (messages,
 * matches, reviews), this table should be re-derived from real reply-rate/retention data
 * crossed by (viewer spec x candidate spec), the same hand-authored-now/pilot-validated-later
 * arc the report already put the centroids and attachment scoring through - log that
 * replacement in docs/spec-test-instrument-changelog.md like any other scoring change, not as
 * a plain copy edit.
 */
export const SPEC_COMPATIBILITY: Record<ArchetypeKey, ArchetypeKey[]> = {
  soft_landing: ["grounded_equal", "ambitious_icon"],
  quiet_fire: ["grounded_equal", "beautiful_mystery"],
  electric_charmer: ["grounded_equal", "free_spirit"],
  ambitious_icon: ["grounded_equal", "ambitious_icon"],
  brilliant_tease: ["soft_landing", "quiet_fire"],
  beautiful_mystery: ["grounded_equal", "quiet_fire"],
  free_spirit: ["grounded_equal", "electric_charmer"],
  grounded_equal: ["electric_charmer", "free_spirit", "ambitious_icon"],
};

/**
 * A [0, 1] compatibility weight from the viewer's spec toward a candidate's - the shared
 * primitive both lib/recommendations.ts (home "Recommended for you") and
 * lib/ranking/people-scoring.ts (Discover's "Recommended for you" sort) turn into their own
 * scaled score. Neutral (0), never negative, whenever either side hasn't taken the test or
 * the pairing simply isn't in the list - a taker who skipped the quiz, or a candidate who
 * isn't anyone's textbook complement, must never be penalized for it, only not boosted.
 * A candidate sharing the viewer's own archetype gets a small flat credit rather than 0 -
 * "someone like me" is a real, if weaker, form of resonance the named complements don't fully
 * cover.
 */
export function specCompatibilityWeight(
  viewerSpec: ArchetypeKey | null | undefined,
  candidateSpec: ArchetypeKey | null | undefined,
): number {
  if (!viewerSpec || !candidateSpec) return 0;
  if (viewerSpec === candidateSpec) return 0.3;

  const complements = SPEC_COMPATIBILITY[viewerSpec];
  const rank = complements.indexOf(candidateSpec);
  if (rank === -1) return 0;
  return 1 - rank * 0.25;
}
