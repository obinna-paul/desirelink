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

## spec-v2.1 — Phase G1 (gender routing and rendering core)

Per docs/spec-test-gender-report.md and docs/spec-test-gender-implementation-plan.md. This
entry covers G1 only - the routing rule and the token-rendering layer. No item, reading, or
pattern-flag content changed in this pass (that's G2); no schema or submit-route change yet
(G3); nothing user-visible yet (G4/G5).

**Routing rule.** `heterosexual_v0_1` (lib/spec-test/gender/forms.ts), named exactly as in the
report. male -> male_user form, assumed attraction target female; female -> female_user form,
assumed attraction target male. This is a disclosed product assumption, never a measured
orientation - see the report's §9 and the plan's DG-1 for the known limitation (the platform's
own profile vocabulary already models eight genders and eight orientations; this instrument's
v0.1 scope is deliberately narrower and says so).

**Token vocabulary.** Eight tokens (lib/spec-test/gender/terms.ts): person, people, they, them,
their, theirs, themself, personPoss. Chosen to cover every gendered referent form the existing
item/reading copy will need once G2 templates it - the exact set may need one more token if G2
finds a construction these eight can't render naturally (e.g. a hyphenated compound); if so,
add it here as a changelog entry, not a silent expansion.

**Rendering.** `renderTerms` (lib/spec-test/gender/render.ts) substitutes `{token}` /
`{Token}` (capitalized) against one of three tables: male_user, female_user, or neutral (used
for any pre-v2.1 row with no stored form). An unknown token throws in development and
degrades to its bare word with braces stripped in production - a content typo should fail
loudly before shipping, never leak `{braces}` to a user.

**Zero-score guarantee.** Enforced two ways, not just documented: (1) a structural test
asserts nothing under lib/spec-test/scoring/ or lib/spec-test/interpretation/ imports the
gender module at all; (2) decideSpecTestResult's declared arity (2 parameters) is asserted
directly, so a future change that quietly adds a third "gender" parameter fails a test rather
than passing review by inspection.

## spec-v2.1 — Phase G2 (content pass)

Tokenized every gendered referent to the OTHER person (never the respondent) across the item
bank, the 8 archetype readings, and the 8 pattern-flag copy strings, using G1's token
vocabulary. Item option ids, section weights, motive loadings, and archetype centroids are
byte-identical to v2.0 - confirmed by diff, not just by intent (git diff touches only
`label`/`prompt`/`copy` string values in three files; loadings.ts and archetypes.ts have zero
diff). Pattern-flag `evaluate` functions (the eligibility rules) are untouched - only their
`copy` strings changed, per the report's explicit instruction that gendered editions may
change target nouns but never the eligibility rule.

**38 item-bank edits, 28 reading edits, 3 pattern-flag copy edits.** Roughly 14 of 24 items
carried a gendered referent; the rest (pure first-person scenarios, mutual "we"/"each other"
phrasing, or quoted direct speech) needed no change.

**The verb-agreement discipline.** Pure token substitution has one hard constraint the report
doesn't mention: `{they}`/`{them}`/`{their}` render as singular "she"/"he" under a gendered
form but as plural "they" under neutral, and English present-tense verbs (and "is/are")
inflect for that difference ("they know" vs "she knows"). Substituting only the pronoun while
leaving a plain-text verb next to it breaks agreement in one direction or the other. The rule
applied throughout: never use a bare `{they}` pronoun as the subject of a present-tense finite
verb; use "the {person}" instead (a common noun - "woman"/"man"/"person" - which is always
grammatically singular, so any verb agreeing with it is correct in all three forms), or
restructure onto a modal ("can", "should" - invariant), an infinitive, a gerund, or a passive
construction. `{they}`/`{them}`/`{their}` remain fine anywhere agreement doesn't apply:
objects, possessives, past tense, or before a modal. Every rewrite here preserves the
original's psychological claim and motive; none changes what an option measures.

**Two corrections caught after the first pass, worth naming as a category of mistake:**
- "Tension in everything neither person is saying" (chemistry-definition-a) describes BOTH
  parties' mutual silence, not the target person's - tokenizing it would have wrongly implied
  two people of the same assumed-target gender. Reverted to plain "person". The same
  distinction protected "both people naturally contribute" (repeated-sunday-d) and "both
  people can give and receive" (soft_landing growthPrompt) from being tokenized in the first
  place: a mutual/couple referent is never the same as a reference to "the other person."
- "Your person is hosting" read as unwanted-possessive once gendered ("Your woman is
  hosting"/"Your man is hosting"). Rewritten to "The person you're seeing is hosting."

**No override registry was built.** The plan's DG-4 anticipated needing an authored per-form
override table for sentences that "genuinely need restructuring." In practice, every case
that needed restructuring (verb agreement, the two corrections above) could be resolved by
rewriting the single canonical template rather than forking it into two authored strings -
so pure substitution covers 100% of current content, and no override infrastructure exists.
If a future string genuinely can't be phrased this way, build the registry then rather than
speculatively now.

**The report's §8 three-question check** (would the claim survive gender reversal; is it
answer-supported; does one variant read as more flattering/sexualized/moralized) is satisfied
structurally rather than case-by-case: pure substitution means the semantic content is
identical regardless of which token values fill it, eligibility rules were never touched, and
the content-symmetry test (`__tests__/lib/spec-test/gender/content-symmetry.test.ts`) proves
every string in this pass renders without a leaked token and is byte-identical across forms
once gendered words are normalized.

## spec-v2.1 — Phase G3 (persistence and API)

**Version bump.** `INSTRUMENT_VERSION` moved from "spec-v2.0" to "spec-v2.1" (plan DG-3).
"spec-v2.0" stays resolvable in `lib/spec-test/items/index.ts`'s bank registry - option ids,
loadings and centroids never changed in G1/G2, only rendered text did, so a fixture or row
tagged with the old version string still validates against the same bank.

**Schema.** Four nullable columns on `SpecTestResult`: `gender`, `routingRule`,
`assumedAttractionTarget`, `quizForm`. Additive migration, null on every pre-v2.1 row.
`sexual_orientation` is deliberately not a column - report §9 is explicit the product must
never store an inferred orientation as if the user stated it.

**Submit route.** `gender` is required in the v2 payload only when `instrumentVersion`
matches the current `INSTRUMENT_VERSION` - a v2.0 submission (none exist in practice, but the
bank stays registered) is unaffected, satisfying the plan's own acceptance criterion in those
exact terms. There is no client-supplied `quizForm`/`routingRule`/`assumedAttractionTarget`
field in the request schema at all - `routeForm(gender)` is the only path that produces them,
called once server-side, so there is nothing for a spoofed request body to override even in
principle (verified by a test that sends contradictory `quizForm`/`routingRule` fields
alongside a real `gender` and confirms only the gender-derived values are ever stored).

**Where rendering happens, and why it's not in interpretation/.** `compose.ts` (under
`lib/spec-test/interpretation/`) still returns raw templated strings, completely gender-
oblivious, exactly as G1's structural boundary test requires. Rendering is a separate step in
`lib/spec-test/results.ts` - one layer above interpretation/, not subject to that boundary
test - which calls `renderTerms` on every string field of the composed reading using the row's
stored `quizForm` (or `"neutral"` for any row with none). This means email and the result page
both automatically receive already-rendered final copy with no changes of their own: they
already consume `results.ts`'s output, so Phase G5 should be close to a no-op for both.

**11 new/extended tests** across the submit route (required-for-current-version, invalid
gender value rejected, correct routing derived for each gender, and the spoofed-payload
override test) and the results read model (a rendered v2.1 row with a stored form, and a
legacy row with none falling back to neutral, both asserted token-leak-free).
