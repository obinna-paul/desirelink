# Spec Test instrument changelog

Every change to the v2 item bank, loadings, centroids, or scoring constants gets an entry
here, per docs/spec-test-v2-implementation-plan.md §14. This is what makes a post-pilot
refit (plan §12) a diff against a documented history instead of an archaeology exercise.

## spec-v2.0 — Phase 1 (instrument core)

Initial build of the v2 scoring engine. Nothing in this version has been shown to a real
respondent yet - it is unvalidated, hand-authored config per the report's own framing
(docs/spec-test-research.md, Executive summary: "a starting hypothesis, not a foregone
conclusion").

**Item bank.** 24 items: the 20 core items from the report's §5 prototype bank verbatim
(Spark 1-8, Pattern 9-16, Partnership 17-20), plus 4 original attachment-scenario items
(`delayed-reply`, `fast-closeness`, `conflict-response`, `need-comfort`) added to cover the
four situations report §6.3 calls for - reassurance after a delayed reply, response to rapid
closeness, conflict pursuit/withdrawal, comfort asking for support - none of which the 20 core
items measure. This resolves plan open decision D-1 in favor of 24 items; see the plan for the
alternative considered (dropping 4 Pattern items to stay at 20).

**Motive/facet loadings.** Every option in the 20 core items loads exactly one scoring
dimension at λ=1, per the report's own bracketed codes (§5). No secondary weights are set in
this version - the report is explicit that secondary weights need expert review before being
invented (§6.1), so none exist yet. Anyone adding secondary weights later should log it here
as a scoring change, not a copy edit.

**Attachment loadings.** The four attachment items are original scenario writing (not lifted
from any published inventory), scored on an ad hoc anxiety/avoidance delta scale in [-1, 1]
per option, chosen to be internally consistent (steady = low both dimensions, push-pull =
moderate both) rather than calibrated against any external instrument. Needs replacement with
piloted item parameters before any claim of measuring "attachment" in a stronger sense.

**Archetype centroids.** Hand-authored from the report's §3 Layer A2 qualitative shapes using
a fixed word→number ladder (high=80, moderate-high=65, moderate/default=50, low=30), documented
per-value in `lib/spec-test/scoring/archetypes.ts`. Two centroids required an interpretive
call the report didn't make explicitly:
- `ambitious_icon`: report gives "high A, often R or V" - chose R (reliability) as the
  secondary based on §4.4's emphasis on partnership and standards.
- `brilliant_tease`: report gives "high C, often V or I-depth" - chose V (social vitality) as
  the secondary based on §4.5 framing wit as verbal/social rather than private.

Both are provisional and should be revisited once pilot data shows whether the "often X"
branch matters for how these two archetypes actually separate from their neighbors.

**ALPHA / SIGMA / TAU.** ALPHA uniform at 1 (no dimension privileged - report §6.1). SIGMA
uniform at 20 (roughly one rung of the H/MH/M/L ladder above). TAU = 15, picked only to make
the self-resolution and split/blend tests in `__tests__/lib/spec-test/` behave sensibly; not
tuned against any real blend-rate target yet (plan §6 recommends 20-35% blend share as a
future tuning target once real submissions exist).

**Lens derivation.** Implemented as a fixed linear projection off the 8-dimension motive
vector (`lib/spec-test/scoring/score.ts`'s `deriveLenses`), NOT as per-option authored lens
deltas as report §6.3 literally specifies ("Each option carries a value of -1, 0 or +1 on
relevant lenses"). This is a deliberate Phase 1 scoping simplification to avoid hand-authoring
~80 additional per-option values without item-writer review; every coefficient's sign is
chosen so the lens's documented high pole (`taxonomy.ts` `LENS_POLES`) increases with the
motive it's derived from. **This should be replaced by per-item authored deltas before the
lens profile is used for anything higher-stakes than descriptive copy.**

**Quality thresholds.** Skip cap = 3 (plan open decision D-3). Speed floor = 500ms on an item,
flagged once 5+ items cross it. Straight-line = 80%+ of answered items sharing one on-screen
position. Contradiction = both declared tension pairs (`compliment-deepest`/
`friend-introduction` and `attractive-life`/`lasting-partnership`) landing on opposed
dimensions simultaneously. None of these thresholds come from data - they're first-pass
engineering judgment calls per plan §6/§12, to be replaced once response-time and skip
distributions exist from real submissions.

**Clear-margin.** `CLEAR_MARGIN = 0.15` (probability gap between primary and secondary
archetype). Provisional, same caveat as TAU above.

**Decision priority.** Implemented as low_signal > split > clear > blend, i.e. a Spark/
Partnership disagreement is reported even when the overall primary looks confident. This
ordering is an interpretation of report §6.2's four rules (which are listed but not
explicitly prioritized against each other) - worth revisiting if pilot data shows split
results are either too rare or too noisy to be a stable third state.
