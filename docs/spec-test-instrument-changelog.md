# Spec Test instrument changelog

Every change to the v2 item bank, loadings, centroids, or scoring constants gets an entry
here, per docs/spec-test-v2-implementation-plan.md §14. This is what makes a post-pilot
refit (plan §12) a diff against a documented history instead of an archaeology exercise.

## spec-v3.0 — Official 28-question replacement

Promoted the 28-item design into the public Spec Test after direct comprehension feedback.
The old 24-item interface remains readable only for historical result compatibility; all new
public submissions use `spec-v3.0`. The former `/spec-test/pilot` URL redirects to the main
quiz, while historical anonymous pilot records remain untouched.

**Question experience.** The instrument keeps the balanced 16 best–worst blocks, eight
independent seven-point intensity anchors, and four uncertainty scenarios, but rewrites every
prompt and option in shorter, conversational language. Situations use familiar Nigerian
social context where it improves clarity (weddings, house parties, gist, plans scattering)
without making slang knowledge a requirement. Comparative controls are labelled “My type”
and “Not really” instead of research terminology.

**Gender presentation.** A required first step asks whether the taker is a woman or man.
Under the existing `heterosexual_v0_1` product rule, a man sees woman/she wording and a woman
sees man/he wording. The server derives the form and assumed target; clients cannot submit a
form directly. Gender changes presentation only and never enters scoring.

**Archetype decision.** Each of the eight balanced attraction dimensions maps transparently
to one public archetype. The strongest measured dimension is primary and the next strongest
is secondary: warmth→Soft Landing, reliability→Grounded Equal, vitality→Electric Charmer,
agency→Ambitious Icon, cognitive play→Brilliant Tease, novelty→Free Spirit, contained depth
→Quiet Fire, and aesthetic selectivity→Beautiful Mystery. This one-to-one mapping removes
the prior centroid-scale bias and makes every archetype reachable from valid answers.

**Result detail.** Official v3 submissions populate the existing rich result model—primary
and secondary archetypes, motives/facets, lenses, ordinary-language uncertainty response,
pattern flags, gender-routed copy, and the original archetype portrait system. Because this
instrument does not independently measure a durable Partnership type, it does not manufacture
a Spark/Partnership split; the primary pattern fills both compatibility fields.

**Quality limits.** More than three skips, five or more answered items below 650ms, or a
profile spread below 0.12 withholds the branded result and offers a retake. A result is clear
only when the top-two score gap is at least 0.18 and total profile spread is at least 0.35;
otherwise it is shown as a blend. These thresholds remain engineering safeguards, not
population-calibrated cut points.

**Claim boundary.** This is the official product experience, but remains a playful,
research-informed beta rather than a clinically validated psychological assessment. The
public landing and result disclaimer retain that distinction.

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

## spec-v2.1 — Phase G4 (quiz UX)

**Wizard sequence.** Age gate → gender (with the scope-notice paragraph and a one-line
purpose statement) → section intro → items → submit. The two context questions (DG-2) are
gone from the flow entirely - `advanceContext`/`answerContext` and the "context" step were
deleted from the component. `lib/spec-test/items/context-v2.ts` and its `index.ts` export are
left in place (nothing reads them today, but the plan's DG-2 recommendation was only to
"remove them from the flow" and "keep the column and the existing rows" - not to delete the
source file or the submit route's still-optional `contextAnswers` field, which stays as a
harmless compatibility no-op for any old client build still sending it).

**Gender step.** Two buttons labelled "Woman"/"Man" (DG-5) submit `"female"`/`"male"`
respectively. Choosing one calls `routeForm` implicitly via the `form` value computed once
per render (`gender ? routeForm(gender).quizForm : "neutral"`) and immediately advances to
item 0 - so a real taker never sees the `"neutral"` fallback form; it exists only as a
defensive default and for any literal render before gender state settles.

**Rendering.** Every item prompt and option label goes through `renderTerms(text, form)` at
render time. No new state: the item bank's canonical `{token}` strings (from G2) are rendered
per-taker exactly the way `results.ts` already renders the composed reading server-side (G3) -
same vocabulary, same substitution function, just called from the client instead.

**Draft persistence.** `DraftShape` gained a `gender` field and lost `contextAnswers`. The
persistence effect writes it on every step except the terminal `submitting`/`low-signal`
states, so a reload mid-quiz resumes on the same form without ever re-asking gender -
`computeInitialStep` treats `!draft.gender` the same way it already treated `!draft.ageConfirmed`,
routing a gender-less resumed draft straight back to the gender step rather than assuming one.

**A real bug caught by the new tests, not by inspection.** The original draft of this phase
had `goToItem` call `submit()` directly once `itemIndex` reached `TOTAL_ITEMS`, from inside
the same `setTimeout` closure chain that plays the select-then-advance animation
(`SELECT_HOLD_MS` → `EXIT_MS`). That closure is created at the moment the *previous* render's
`selectOption` runs - before the final answer's `setResponses` update has committed - so the
`submit` it calls is stale and builds its request from a `responses` map that is always
missing the very last answer. The old Phase 3 flow never hit this because the last item
handed off to a context-question step (itself driven by a fresh, non-stale click handler)
before ever calling submit; removing that intermediate step directly exposed the race. Fixed
by having `goToItem` only set `step` to `"submitting"`, and moving the actual `submit()` call
into a `useEffect` keyed on `step` - effects run after the state update commits, so it always
sees the completed `responses` map. The same effect also now covers the "resume an
interrupted mid-submit draft" case that used to be a separate mount-only effect, since both
are really the same condition: "we're in the submitting step and haven't already errored."

**9 tests** (up from 5 pre-existing, minus the removed context-question test, plus 5 new):
no scored item or item option renders before gender is answered; a low-signal retake preserves
the chosen gender and form without re-showing the gender step (verified against a real
tokenized item's rendered text, not just the stored value); a resumed draft never re-asks
gender; and the two forms are proven to differ only in their substituted terms, never in the
underlying template.

## spec-v2.1 — Phase G5 (result surfaces)

**Verification pass, as the plan expected.** The result page
(`app/spec-test/result/[id]/page.tsx`) and the result email
(`components/emails/spec-test-result.tsx` via `lib/email/spec-test-notifications.ts`) both
already consumed `getSpecTestReading`'s `copy` output before this phase even started - G3 put
the rendering inside `results.ts` specifically so both surfaces would inherit it automatically.
Read both files end-to-end to confirm neither one reaches around `results.ts` for raw,
unrendered strings anywhere (e.g. by importing `readings-v2.ts` or `compose.ts` directly) -
they don't. No code change was needed in either file for this phase.

**Share card, verified rather than assumed.** The plan flagged
`app/spec-test/result/[id]/opengraph-image.tsx` as "likely no change" but asked for
verification, not an assumption. It reads exactly two fields: `copy.headline.name` (an
archetype's proper noun, never templated - readings-v2.ts's `name` field has no `{token}` in
it for any of the eight archetypes) and `copy.headline.tagline` (templated in principle, since
`renderResultCopy` does call `renderTerms` on it, but authored with no gendered referent for
every archetype). Added a new test file,
`__tests__/lib/spec-test/gender/result-surfaces.test.ts`, asserting this directly and more
strictly than the existing cross-form symmetry test: every tagline renders **byte-identical**
to its own un-rendered source string under both `male_user` and `female_user` - not just
"symmetric once normalized," but literally unchanged - so the share card needs no per-form
branch and none was added.

**Long-term partner guidance stays behavioural.** `longTermFit`
(`ARCHETYPE_READINGS_V2[key].longTermFit`, report §4 "Long-term partner brief") is templated
the same way as every other reading field - "the {person} who..." - so gender only ever swaps
which word fills the referent slot. The substance of the brief (what kind of steadiness,
initiative, or communication style the reading recommends) comes entirely from the taker's
motive/lens scores computed in `compose.ts`, completely gender-oblivious per the G1 boundary
guarantee - gender was never able to change the advice itself, only who it's worded to be about.

**2 new tests.** No production code changed.

## spec-v2.1 — Phase G6 (analytics and governance)

**Schema.** New `SpecTestFormStat` model (`instrumentVersion`, `quizForm` composite key,
`submittedCount`, `lowSignalCount`) - additive, mirrors `SpecTestInstrumentStat` but scoped
per form. Needed specifically for the low-signal rate: every other by-form metric can be
computed straight from `SpecTestResult` rows (they've carried `quizForm` since G3), but a
low-signal attempt never becomes a row at all, so without this counter there would be no
denominator for "what share of male_user attempts came back low-signal" the same way
`SpecTestInstrumentStat` already solves that for the combined rate. `submitV2`'s two call
sites for `bumpInstrumentStat` each gained a matching `bumpFormStat` call, only firing when
`routing` is non-null (i.e. gender was supplied) - same best-effort, non-blocking contract.

**`admin-stats.ts` gains `getSpecTestConfidenceMixByForm` and
`getSpecTestTypeDistributionByForm`** - the same shapes as their combined counterparts, one
result per `QUIZ_FORMS` entry. **`calibration.ts`'s `getSpecTestItemAnalytics` gains an
optional `quizForm` parameter** that narrows its query; omitted, behavior is unchanged from
before this phase - so item timing and option-distribution comparisons by form (report §10)
are available as a library call even though the admin page doesn't render a doubled 24-item
table for it (see below).

**Admin page.** A new "By form" section under the existing type-distribution/confidence-mix
grid: submitted/clear/blend/split/low-signal counts and rates per form, plus each form's top
three archetypes, with the report §10 caution stated inline - *"Gender only ever changes
which pronouns the questions use... it never changes scoring. A gap between forms here is a
starting point for investigation, not evidence of an innate difference: rule out sample size,
wording, and item bias before drawing any conclusion from it."* Deliberately not duplicated:
a full per-form item-analytics table (24 items × 4 options × 2 forms). That granularity is
available via `getSpecTestItemAnalytics(version, quizForm)` for whoever is actually doing the
item-bias review the caution calls for, but rendering it permanently on the dashboard was
judged more noise than signal for the common case of "is one form obviously broken."

**Public scope documentation (report §13: "Document the scope and limitations publicly").**
Already satisfied by G4's gender-step scope notice - *"Current test scope: this version is
designed for men attracted to women and women attracted to men"* - shown to every taker
before they answer a single scored item, which is "where takers can see it" in the most
literal sense the plan's own §10 asks for. No separate FAQ/about page was added: the landing
page (`app/spec-test/page.tsx`) is a deliberately single-screen, no-scroll funnel (see its own
file comment), and stapling a governance disclosure onto a conversion page would fight that
page's actual job without reaching anyone who doesn't already see the in-quiz notice.

**The marketing constraint stated here, for whoever writes marketing copy for this
instrument:** this version is not "for everyone" - it assumes heterosexual attraction
(`ROUTING_RULE = "heterosexual_v0_1"`, chosen and named specifically so a future routing rule
covering other orientations is a new registered value, not a rewrite) and offers exactly two
presentation forms. Marketing copy should not claim broader applicability than that until a
new routing rule actually exists and has been through the same validation this one plans to
go through (report §11).

**Not built, same as the plan's own scope line:** the DIF / measurement-invariance analysis
itself, and the research-consent surface it depends on (`lib/spec-test/calibration.ts`'s file
comment already documents why the consented-export path doesn't exist yet - that blocker is
unchanged by this phase).

**14 new/extended tests** across `admin-stats.test.ts` (both new by-form functions),
`calibration.test.ts` (the new `quizForm` parameter), and the submit route's test suite (the
new `SpecTestFormStat` upsert on both the low-signal and success paths, keyed by the derived
form exactly like the existing `SpecTestInstrumentStat` assertions).

---

This closes Phase G6, the last phase in
[`docs/spec-test-gender-implementation-plan.md`](./spec-test-gender-implementation-plan.md).
Every phase (G1-G6) shipped in the sequence the plan laid out, each with its own commit and
its own full test/typecheck/lint pass before landing.

## spec-v2.1 — Reading copy voice rewrite

**Why.** Direct user feedback on a live result ("Soft Landing"): the archetype prose read as
generic, clinical, and confusing rather than fun - sentences like "Your attraction system
relaxes when care is unmistakable" and "Relief can masquerade as compatibility" are accurate
descriptions but not something anyone recognizes themselves in or wants to share. That prose
had been transcribed close to verbatim from `docs/spec-test-research.md` §4's "Provisional
narrative library" - a research document's voice, not a consumer quiz's.

**What changed.** All six narrative fields (`coreReading`, `whatItSaysAboutYou`, `strength`,
`blindSpot`, `longTermFit`, `growthPrompt`) for all eight archetypes in
`lib/spec-test/interpretation/readings-v2.ts`, the eight "dating loop" pattern-flag copy
strings in `lib/spec-test/interpretation/pattern-flags.ts`, and the spark/partnership "twist"
template in `lib/spec-test/interpretation/compose.ts` - rewritten in second person, with
concrete scenarios and images ("texts to check you got home safe" instead of "your attraction
system relaxes when care is unmistakable"), aiming for "a sharp friend describing you
accurately" rather than a clinical abstract.

**What didn't change.** The underlying claim for each archetype - what it means, which motive
pattern it represents (`lib/spec-test/scoring/archetypes.ts`), which pattern-flag rule fires
when (`evaluate` functions in pattern-flags.ts, untouched) - none of that moved. This is a
delivery/voice rewrite of existing, already-accurate content, not new psychological claims.
The pattern-flag copy keeps the report's required epistemic hedge ("may have", "may
sometimes") in every line - a stronger sentence, not a stronger claim. Archetype names and
taglines are untouched (the taglines were already short and doing their job; the paragraphs
underneath them weren't).

**Gender rendering.** Every gendered referent in the new copy still goes through the same
`{token}` vocabulary from Phase G2, with the same verb-agreement discipline (no bare
`{they}`/`{them}` as the subject of a present-tense finite verb). Verified by the existing
gender symmetry/render test suite (`__tests__/lib/spec-test/gender/*`) and
`results.test.ts` - both suites pass unchanged against the new content with zero test
modifications required, confirming the rewrite is a content swap that fits the existing
rendering pipeline rather than something that needed new plumbing.

**No instrument version bump.** Option ids, loadings, centroids, and pattern-flag eligibility
rules are unchanged - this is copy-only, same precedent as G2's tokenization pass (which also
didn't bump the version on its own).

## spec-v2.1 — Result depth expansion (two new modules)

**Why.** Direct follow-up feedback: 24 answers were producing a result that felt shallow -
one fixed archetype template plus a couple of one-line flags, when the engine actually
computes a taker's own 7-motive vector and a 4-label attachment read (report §3 Layers A and
C) and had simply never shown either. The voice rewrite above fixed *how* the result reads;
this fixes how much of what the taker actually answered makes it into the result at all.

**Two new modules, both built from data the engine already scores - no new questions, no new
scoring, no schema change:**

- **Your top signals** (report §10 item 2: "Why this pulls you in: three specific attraction
  signals drawn from answers"). `composeSpecTestResult` now ranks the taker's own 7 motive
  scores and surfaces the top 3 with a per-motive description
  (`lib/spec-test/interpretation/signal-readings.ts`'s new `MOTIVE_READINGS`). Two takers who
  land on the same primary archetype (identical `corePull`) can now see different top signals
  if their underlying motive mix differs - a real personalization the templated archetype
  copy alone could never provide. Rendered directly under "Why this pulls you in" on the
  result page.
- **How you handle uncertainty.** The attachment-response read (`AttachmentScore.label`) was
  computed on every usable submission and stored, but never shown anywhere. New
  `ATTACHMENT_READINGS` gives each of the four labels a title and a paragraph, framed per the
  report's own safety boundary (§9: never a diagnosis, ordinary language only, never a
  clinical attachment-theory term) - the same four labels `taxonomy.ts` has always declared
  as the *only* ones this product may show. Rendered as its own section between "What it says
  about you" and "Your likely dating loop"; omitted entirely on the rare row with no
  attachment item answered (`attachmentInsight: null`).

**Existing fields lengthened too.** `strength`, `blindSpot`, and `longTermFit` for all 8
archetypes each gained one more concrete sentence - still a single paragraph each (no change
to how the result page renders them), just more specific and less generic per archetype.

**Both new modules go through the same rendering and safety pipeline as everything else.**
`SpecTestResultCopy` gained `topMotives`/`attachmentInsight`; `results.ts`'s
`renderResultCopy` renders both through the existing `{token}` gender pipeline; the gender
symmetry/render test suite and the interpretation safety-lint test (banned clinical/ranking
language) were both extended to cover the two new content dictionaries and pass without any
changes to the pipeline itself - the new modules are a content addition that fits machinery
already built for this, not new plumbing.

**No instrument version bump, no schema change.** `motiveScores` and `attachment` were
already computed and persisted for every usable v2 row (Phase 2/7 of the original v2
rebuild) - this only adds a presentation layer over data that already existed.

## spec-v2.1 — Item bank wording pass

**Why.** Direct feedback: several prompts and options needed a reread to parse, and the
overall tone read closer to a research abstract than a quiz someone would actually enjoy
taking, on a product that should feel fun and openly flirtatious given its audience.

**What changed, and what absolutely did not.** All 24 prompts and all 96 option labels in
`lib/spec-test/items/spec-v2.ts` were rewritten for plain, first-read clarity and a lighter,
flirtier tone. Every item id and every option id is byte-for-byte unchanged, and so is every
option's assigned scoring dimension in `lib/spec-test/scoring/loadings.ts` (`OPTION_MOTIVE_LOADINGS`,
`OPTION_ATTACHMENT_LOADINGS`) and `TENSION_ITEM_PAIRS` - this file never touched loadings.ts,
so there was nothing to keep in sync beyond writing each option so it still clearly reads as
evidence of the exact motive or attachment code the comment beside it already names. Verified
by the full existing test suite passing unchanged, most importantly
`__tests__/lib/spec-test/loadings.test.ts` (confirms every optionId still has a matching
loadings entry) and the gender content-symmetry suite (confirms the `{token}` vocabulary and
verb-agreement rule were applied correctly to the new wording).

**The four attachment-scenario items** (`delayed-reply`, `fast-closeness`, `conflict-response`,
`need-comfort`) got lighter touches than everything else - these measure a real emotional
pattern, and the report's own hedge about honest framing (§9) argues for keeping them sincere
enough to get a genuine answer rather than one picked because it was the funniest option.

## spec-v2.1 — Two more result modules: hidden lens insight and a fuller partner brief

**Why.** Direct follow-up: the result still read as a recap of answers already given, when it
should tell the taker something they didn't already know about themselves - and the "who
tends to work for you" section should draw on more than a single archetype label. The user
specifically pointed to Tim LaHaye's *Why You Act the Way You Do* as the kind of holistic,
narrative-rich character sketch to aim for.

**What the report actually says about that book, checked before writing anything:** §1
covers it directly - "The book is useful for narrative technique... Udala should borrow that
breadth and human tone. It **should not** adopt the four temperaments as the scoring
foundation." So this pass borrows the *technique* (weave several real signals into one
textured character sketch, the way LaHaye connects temperament to work, conflict, love and
blind spots) without inventing a second, untested four-type classification system layered on
top of the actual one - which would also have meant fabricating content with no basis in the
report, exactly what was asked not to do.

**"Something you might not know about yourself"** (new section, always present). Every
result already scores all 8 interpretive lenses (report §3 Layer B - Spark-Safety,
Closeness-Autonomy, Fast-Slow burn, Directness-Intrigue, Private-Public, Admiration-Mutuality,
Mind-Embodied, Exploration-Commitment), and none of the 8 were ever shown. `composeSpecTestResult`
now picks the taker's single most extreme lens (furthest from the neutral midpoint, in either
direction) and shows a specific, playful reveal for it
(`lib/spec-test/interpretation/signal-readings.ts`'s new `LENS_INSIGHTS`, 16 entries: one per
pole per lens). A lens score is extracted across several answers, not chosen directly on any
one of them - which is exactly why this is new information to the taker rather than a recap.

**A fuller partner brief, not a new type.** The existing archetype-level `longTermFit`
paragraph is untouched, but the result page now shows a second, trait-based partner note
right alongside it, pulled from that same selected lens
(`LensPoleReading.partnerNote`, e.g. "Your best match is a {person} who keeps a little
unpredictability alive, even years in.") - report §7's "person to marry" section calls this
out explicitly: "Do not output 'Marry a Grounded Equal.' Output a **behavioral partner
brief**." The brief a taker now sees is synthesized from two independent computed signals
(archetype + lens), not a single label.

**Voice note.** Per explicit instruction, this pass (and the item-bank pass above) avoid em
dashes - short sentences and commas instead, which if anything reads more casual and easier
to skim on a phone.

**Tests.** New coverage in `interpretation.test.ts` (lens selection picks the correct key and
direction, and always exists unlike attachment) and the gender content-symmetry suite (all 16
lens entries render token-safe and symmetric across forms), plus the safety-lint test's banned
term list now also runs against the new lens copy.

## spec-v2.1 — Removed the standalone age-gate screen

**Why.** Direct request to remove the "Before we start / I'm 18 or older - Start" click-through
that used to be the second screen of the quiz, before the gender question.

**What still exists.** This removes a redundant confirmation click, not the product's actual
age signaling: the "18+" badge (`components/spec-test/age-badge.tsx`) still shows on every
Spec Test page (landing, quiz, result), the landing page still frames the quiz as "a playful,
research-informed reading... (beta)," and the platform's real, binding age confirmation
happens at account signup (`components/auth/auth-shell.tsx`: "By continuing, you confirm you
are at least 18 years old"). An anonymous quiz taker who never creates an account was never
bound by the quiz's own click-through anyway, so it was friction without an equivalent
safeguard behind it.

**What changed.** `components/spec-test/quiz-flow.tsx`: removed the `"age-gate"` step, its
JSX, and the `ageConfirmed` field from the persisted draft shape - the wizard now opens
directly on the gender question, same scope-notice and copy as before. Updated the test
suite's `startQuiz()` helper and the two tests that referenced the old screen.

**9 tests updated, 0 added or removed** - same coverage, just no longer routing through a
screen that no longer exists.

## spec-v2.1 — Fixed: going back to an already-answered question got the quiz stuck

**The bug, as reported.** Answering a question, going back to change an earlier one, and then
being unable to select anything, skip, or go back further - completely stuck.

**Root cause.** `goToItem` pre-fills `selectedOptionId` with an item's existing answer when
navigating back to it, so the prior pick still shows highlighted. But `selectedOptionId` was
also being used everywhere else as the "we're mid-transition, ignore clicks" lock: the early
returns in `selectOption`/`skipItem`/`goBack`, and the `disabled` prop on the option buttons,
the Back button, and the Skip button. The instant you landed back on an answered question,
every control on screen disabled itself for a reason that had nothing to do with an actual
in-flight transition.

**Fix.** Added a separate `isLocked` state that is the real "ignore clicks" flag - true only
for the ~580ms hold-then-exit window after a fresh click, and explicitly reset to `false`
every time `goToItem` lands on an item (including via `goBack`). `selectedOptionId` now only
drives which option shows highlighted; it no longer gates any interactivity.

**Test.** New regression test drives exactly the reported scenario: answer two items, go back
to the first of the two, assert the back/skip/option controls are not disabled, pick a
different option than originally chosen, confirm the quiz actually advances instead of
freezing, then complete the quiz and confirm a valid (non-null) answer was submitted for the
revised item.

## spec-v2.1 — Simplified the gender step to just the question and its two options

Removed the scope notice ("Current test scope: this version is designed for...") and the
"This only changes who the questions describe" explainer added in Phase G4, per direct
request to keep the screen to the bare question and its two buttons. No test depended on
either removed string.

## spec-v2.1 — Fixed "the twist" stacking two archetype names with no explanation

**The bug, as reported.** On a split result, the result page showed the secondary-influence
module ("Right behind it: Brilliant Tease...") and the Spark/Partnership twist module in the
same card at the same time - up to three archetype names on screen with no room to explain
any of the newer two, read as confusing rather than insightful.

**What the report actually specifies.** §10's result-page structure lists "3. The twist:
secondary Spec **or** Spark-Partnership split" as one module with two possible fillings, not
both simultaneously. The shipped code had drifted from that.

**Fix.** `compose.ts` and `app/spec-test/result/[id]/page.tsx`'s "The twist" card now render
`sparkPartnershipTwist.copy` when the result is a split (mentioning both the taker's Spark-lean
and Partnership-lean archetype, spelled out in one connected explanation) and
`secondaryInfluence` otherwise - never both. Also added an `inlineTagline` helper so an
archetype's tagline folds into the middle of a sentence instead of colliding with its own
capitalization/punctuation when quoted inline.

**Test.** `spec-test-result-page.test.tsx`'s existing split-result test now also asserts the
secondary-influence line is absent when the twist module is shown, confirming the either/or
behavior actually holds rather than just happening to pass.

## spec-v2.1 — Depth pass: pattern flags, archetype readings, and motive/lens copy

**Why.** Direct escalation on top of the spec-v2.1 lens-insight pass above: "these sections
are too brief, too snappy, too shallow... Deep, very insightful, very specific, very
relatable, and very detailed." The earlier pass fixed voice and added new modules but left
every individual string at one terse sentence - fine for a first read, not enough once a
taker is looking at their actual result.

**What changed, and what didn't.** No new claims, dimensions, or archetypes - every string
below still describes exactly what `lib/spec-test/scoring/archetypes.ts`'s centroids and
`docs/spec-test-research.md` already support for that pattern/archetype/lens/motive. Only the
delivery changed: each string went from a single sentence to a short paragraph built the same
way throughout - a concrete, relatable scenario, then the psychological "why this happens"
underneath it - while keeping every required hedge ("may have", "you might") since none of
this is a diagnosis.

- `lib/spec-test/interpretation/pattern-flags.ts`: all 8 dating-loop rules' `copy` rewritten.
- `lib/spec-test/interpretation/readings-v2.ts`: all 8 archetypes' `coreReading`,
  `whatItSaysAboutYou`, `strength`, `blindSpot`, and `longTermFit` rewritten (`growthPrompt`
  left as-is - it's a deliberately short closing line, not a shallow one).
- `lib/spec-test/interpretation/signal-readings.ts`: all 7 `MOTIVE_READINGS` entries and all
  16 `LENS_INSIGHTS` pole `copy` fields rewritten. `partnerNote` fields and `ATTACHMENT_READINGS`
  were already at this depth from the original pass and are unchanged.

**Verb-agreement and token checks.** Several longer drafts initially used a bare `{they}`/
`{them}` as the subject of a present-tense verb (e.g. "{they've} decided", "whenever
{they're} ready") - all rewritten to avoid that construction (a modal, a passive, or "the
{person}" as subject) per the standing gender-rendering rule, since neutral "they" and
gendered "she"/"he" take different verb forms. Also caught a few drafts that had drifted to
generic "a person"/"someone" instead of the established `{person}` token.

**Tests.** Full suite (543 tests) still green with no changes needed - the safety-lint banned
term list and the gender content-symmetry checks operate on the token structure and vocabulary
of these strings, not their length, so the added depth didn't require new fixtures. Confirmed
zero em dashes across all three files via direct grep, per the standing no-em-dash rule.

## spec-v2.1 — Phase 1: a Spec Test result follows the taker into their account

**Why.** Until now a result was a link, nothing more - taking the test and later signing up
never connected the two, and there was no way to see, revisit, or retake a result from inside
the app. This is the first step of wiring the test into identity: link results to accounts
reliably, give the app a place to surface "what's your spec," and let the retake happen
without ever touching onboarding (explicit instruction: never add it there, never force it).

**Fixed a real gap in the existing anonymous-to-signup link.** `linkSpecTestResultIfConsented`
(app/api/signup/route.ts, lib/auth.ts) already matched a pre-signup result to a new account by
email - but only if `consentMarketing` was also true, which conflates two different things: "I
gave my email to get my result" and "keep me updated about Udala" (a separate switch on
components/spec-test/email-capture-form.tsx, off by default). Most takers who gave an email
just to get their result, without opting into marketing, were never actually linked. Renamed to
`linkSpecTestResultToProfile` and dropped the consent requirement - it now matches on the email
given for the result alone, which is what "remember this is mine" actually means. Marketing
consent still only ever controls marketing emails, untouched.

**Signed-in takers link immediately, no email step at all.** `app/api/spec-test/submit/route.ts`
now checks the session and, when one exists, writes `profileId` directly onto the created
`SpecTestResult` row - so a member taking the test from inside the app never needs to type an
email to keep their result; it's tied to their account the moment it exists. Also enforces a
30-day retake cooldown server-side for a signed-in submission (a fresh anonymous submission is
never capped), returning 429 with a plain-language date rather than silently overwriting.

**Two entry points, one shared nudge popup, shown once ever.**
`components/spec-test/spec-test-nudge-modal.tsx` explains the test ("takes about 4 minutes")
with Take it now / Take it later, and is opened from either surface:
- The "What's your spec?" row in profile settings
  (components/profile/spec-settings-row.tsx, wired into edit-profile-form.tsx's existing
  settings list) - opens the nudge if untaken, or links straight to the saved result if not.
- A one-time popup on next app open for any signed-in profile that hasn't taken it and hasn't
  been shown the nudge before (app/(app)/layout.tsx's `showSpecNudge`, same
  gate-a-modal-in-the-layout pattern as the existing creator-welcome modal).

Whichever surface shows it first marks `Profile.specTestNudgeShownAt` (new column, mirrors
`creatorWelcomeShownAt` exactly) via `POST /api/profile/spec-test-nudge-seen` - a mount here IS
the "shown" event, so the other surface never shows it again either, satisfying "just once,
ever" regardless of which one the taker saw first. Deliberately never added to the onboarding
wizard or any redirect gate - per direct instruction, this stays opt-in and low-pressure.

**The result page recognizes a signed-in viewer.** No re-entering an email, and no pre-fill
either - since the result is already linked at submission time, the email-capture card and
"Join Udala" messaging are replaced with a plain "Saved to your profile" confirmation and a
"Back to Udala" button. Getting back into the app needs no re-login: the quiz lives at ordinary
app routes under the same session cookie, so a signed-in taker never actually leaves their
session by visiting `/spec-test/quiz`.

**Sparkle icon removed everywhere**, not just the result page (per explicit instruction): the
admin nav's "Spec Test leads" link now uses a non-sparkle icon (also the new nudge modal and
settings row's icon) instead of `Sparkles` - see the icon note in the next entry below for why
it changed again shortly after this one.

**Tests.** New coverage in `__tests__/api/spec-test-submit-route.test.ts` (signed-in submission
links `profileId` immediately; a retake inside 30 days is rejected with no row written; a retake
past 30 days succeeds) and `__tests__/app/spec-test-result-page.test.tsx` (signed-in viewer sees
the confirmation/back-to-app CTA, never the anonymous Join card or email form). Full suite: 568
tests, 100 suites, all green.

## spec-v2.1 — Phase 2: spec shown publicly, filterable in Discover, used in ranking

**Why.** Direct follow-up to Phase 1: identity and settings were wired up, but a taker's spec
still did nothing for them beyond their own account - it wasn't visible to anyone else,
couldn't be searched for, and had zero influence on who Discover or the home "Recommended for
you" rail actually showed them. This closes the loop the original ask was really about: "if my
result is Soft Landing, how do I find who will give me that."

**Two separate consent boundaries, not one.** `Profile.specShownPublicly` (new column, default
`false`) gates whether a taker's spec is ever *shown* to anyone else - a badge on their profile
card/page, and eligibility for the Discover spec filter. It does NOT gate whether the spec is
*used* internally for ranking: that runs unconditionally once a spec exists, the same default
every other behavioral signal in this codebase already uses (`CreatorAffinity`, search
interactions, etc. have no per-signal opt-out either). A Spec Test result is materially more
intimate than a bio (attachment style, dating patterns), so *display* gets its own explicit
opt-in; *use* doesn't need one to stay consistent with how the rest of the app already treats
personalization data.

**The compatibility table** (`lib/spec-test/compatibility.ts`, new): `SPEC_COMPATIBILITY` maps
each archetype to a ranked list of complements, directly transcribed from that archetype's own
`longTermFit` paragraph in `readings-v2.ts` (each one already names its ideal partner in prose -
this just formalizes it). Explicitly documented as hand-authored and provisional, same status as
the archetype centroids in `scoring/archetypes.ts` - it should be re-derived from real
reply-rate/retention data crossed by (viewer spec x candidate spec) once enough exists, logged
here as a scoring change when that happens, not folded in as a copy edit.

**Where it shows up:**
- **Profile badge.** `components/home/profile-card.tsx` (every card grid: Discover, search,
  home) and the full profile page (`components/profile/profile-view.tsx`) render "Reads as
  {spec}" whenever `specShownPublicly` is true and a result exists. Toggle lives in profile
  settings' Privacy section, only shown once a spec exists to show.
- **Discover filter.** A new "Spec" multi-select in the existing filter panel
  (`lib/discover.ts`'s `DiscoverFilters.specTypes`) - `where.specTestResults` scoped to
  candidates with `specShownPublicly: true`, so the filter can never be used to probe someone's
  private result.
- **Ranking.** Both places this codebase already ranks people got a new term: the home
  "Recommended for you" rail (`lib/recommendations.ts`) adds up to +15 points and a "Great spec
  match" / "Shares your spec" reason chip (the rail's own subtitle already promised "preference
  overlap" - this is the first term that actually delivers it); Discover's "Recommended for you"
  sort (`lib/ranking/people-scoring.ts`) adds a new `spec: 0.1` weight, reweighting the existing
  terms down slightly to make room. Both contribute exactly 0, never a penalty, whenever either
  side hasn't taken the test - the common case today.

**Icon note.** `Compass` was already claimed by `AccountTypeBadge`'s Explorer icon and would
have collided in the same badge row on the profile page - switched every spec-test icon
(nudge modal, settings row, admin nav, the new badges) to `Fingerprint` instead, still never
`Sparkles`.

**Tests.** New: `__tests__/lib/spec-test/compatibility.test.ts` (weight table behavior - no
penalty for an untaken test, same-spec credit, complement tapering, every archetype has a valid
non-empty list), `__tests__/lib/recommendations.test.ts` (spec term boosts and explains a
complement, credits but doesn't over-credit a shared spec, never penalizes an untaken test),
new cases in `__tests__/lib/ranking/people-scoring.test.ts` (spec-compatible candidate outranks
an identical one without the signal) and `__tests__/lib/discover.test.ts` (the spec filter's
`where` clause, including that an unrecognized value is dropped rather than breaking the
filter), plus updated fixtures in `__tests__/components/profile-card.test.tsx` (badge shown
only when `specShownPublicly` is true and a result exists) and
`__tests__/api/profile-account-type-upgrade.test.ts`. Full suite: 581 tests, 102 suites, all
green.

## spec-v2.1 — Phase 3: claim-by-cookie, closing the "Join Udala" gap

**Why.** Direct question after Phase 1 shipped: `linkSpecTestResultToProfile` only ever had an
email to match against, which the anonymous result page only collects if the taker uses the
"email me this" card. A taker who clicks "Join Udala" straight off the result page - arguably
the *more* common path, since it's the primary button and "email me this" is the secondary one
below it - never gives an email at all, so that result had no way to ever find its way to the
account they went on to create.

**The fix: a second, independent claim path that needs no email.**
`lib/spec-test/claim-cookie.ts` (new) sets an httpOnly `spec_test_result_id` cookie on every
anonymous v2 submission (`app/api/spec-test/submit/route.ts`), holding just that result's id.
`claimSpecTestResultById` (new, `lib/spec-test/legacy.ts`) reads it back at both signup paths -
`app/api/signup/route.ts` for credentials, `ensureProfileForAuthUser` in `lib/auth.ts` for
Google/X - and claims the exact result it names, gated only on it still being unclaimed
(`updateMany` with `profileId: null` in the `where`, never `update`, so a stale/already-claimed/
missing id is a silent no-op rather than a thrown error).

**Both claim paths always run, not either/or.** The cookie claim (by id) and the existing email
match both fire on every signup. Either can succeed alone; both succeeding just links two
results to the same profile, which is harmless - the most recently created one still wins for
every "current spec" read (the nested `specTestResults` selects in `lib/home-feed.ts`,
`lib/recommendations.ts`, `lib/ranking/people-scoring.ts` are all already ordered
`createdAt: desc, take: 1`). This means a taker who took the quiz twice anonymously - once
giving an email, once not - still gets a fully correct link no matter which of the two attempts
the cookie happens to point at.

**Why a cookie and not, say, matching on IP or device fingerprint.** A cookie is the simplest
mechanism that's exactly as precise as the problem needs: it only ever identifies "the same
browser that just took the test," makes no inference about identity, and expires on its own
(30 days) rather than needing explicit cleanup. It's cleared proactively once used
(`clearSpecTestResultCookie`), though that's a hygiene step, not a correctness one - a stale
cookie is inert the moment its result gets claimed.

**Fixed a stale doc comment while in the area.** `linkSpecTestResultToProfile`'s comment used to
say linking "deliberately does NOT feed recommendations/ranking" - true when it was written,
false as of the Phase 2 entry above (`lib/spec-test/compatibility.ts` now reads a linked
result's spec for exactly that). Updated to point at Phase 2 instead of asserting something no
longer accurate.

**Tests.** New `__tests__/api/signup-route.test.ts` (the cookie claim fires and clears
regardless of the signup email; it's skipped cleanly when no cookie is present; the email match
still runs either way) and new assertions in `__tests__/api/spec-test-submit-route.test.ts`
(the claim cookie is set on an anonymous submission, never set once a submission is already
linked via an active session). The OAuth path (`ensureProfileForAuthUser`) reuses the same
`claimSpecTestResultById`/`readSpecTestResultCookie` already covered by the signup-route tests,
consistent with this file having no existing dedicated test harness of its own. Full suite: 583
tests, 103 suites, all green.

## spec-v2.1 — Invite-a-friend share action on the result page

**Why.** Direct question: is there a share button, and if so it shouldn't share the taker's own
result - it should invite a friend to take the test themselves, since that's what actually
grows who takes it. There was no share button on the result page at all before this (the
`{/* 12. Share card */}` comment labeling the Join/Back CTA block was aspirational, not
describing anything that existed).

**What it does.** `JoinCta` (`app/spec-test/result/[id]/page.tsx`) now renders the existing
`components/ui/share-button.tsx` (already used elsewhere in the app for events/services/posts -
reused rather than building a new one) pointed at `/spec-test`, the quiz's own public landing
page - never this taker's personal result URL. The share title uses the taker's own archetype
as a curiosity hook without disclosing the reading itself: "I got {spec name} on the Spec Test.
Take it and see what you get." Shown in both the signed-in and anonymous branches of `JoinCta`,
and on both v1 and v2 result rows - inviting a friend is independent of whether the taker is
already a member.

**Tests.** New assertions in `__tests__/app/spec-test-result-page.test.tsx`: the invite button
renders on a full v2 result, a signed-in result, and a v1 legacy result. Full suite: 584 tests,
103 suites, all green (`ShareButton` itself has no dedicated test file - pre-existing, already
shipped in three other places in the app, so none was added for this integration either).

## spec-v2.2 — Forced-choice scoring correction

**Why the version changed.** The v2.1 response vector always summed to 200 (mean 25 across
eight dimensions), while its hand-authored archetype centroids summed to 365–460. Absolute
squared distance therefore favored low-total centroids: a seeded 5,000-response uniform null
simulation classified 49.1% as Grounded Equal, 0.16% as Ambitious Icon and 0.02% as Brilliant
Tease. This is a scoring-semantics change, not a tuning change, so old rows and old-version
submissions keep the v2.1 classifier.

**New classifier.** `lib/spec-test/scoring/forced-choice.ts` treats each answer relative to the
three alternatives shown beside it. For each archetype, option utilities come from the same
provisional centroid descriptions, but item log probabilities are centered at their uniform-
choice expectation and divided by their accumulated null standard deviation. Additive
centroid-level differences therefore cancel. The public motive/facet vector is independently
chance-centered: one null SD maps to 15 points around a neutral 50. Skipped items contribute
nothing to any dimension or archetype.

**Decision gates.** A maximum standardized pattern signal below 2.25 returns low signal with
`insufficient_pattern`; a clear result requires evidence at least 3.0 and a 0.15 primary/
secondary probability margin. The old authored contradiction heuristic remains available in
quality diagnostics but is non-blocking; it is not yet persisted as an analytics field. A
Spark/Partnership split requires at least six answered motive items in each section, so the
current four-item Partnership section cannot overrule the overall result.

**Null audit.** With the same seeded 5,000 uniform-response run, v2.2 withholds 90.14% as low
signal. Among the 493 usable null outliers, winner shares range from 9.7% to 15.0%; Grounded
Equal is 13.2%. These figures validate removal of the structural fallback, not real-world
accuracy. Constants remain provisional until pilot data and a hold-out sample support fitting.

**Compatibility.** `spec-v2.0` and `spec-v2.1` resolve the unchanged item ids but route through
the preserved distance classifier. `spec-v2.2` alone uses the replacement. Historical result
rows are never rescored.

## spec-v3-pilot.1 — Balanced measurement-model foundation (not live)

**Status.** This is a research/pilot contract only. It is not registered in the production
submit route and does not replace `spec-v2.2`.

**Question structure.** The pilot bank contains 16 four-option best–worst attraction blocks,
eight independent seven-point motive-intensity anchors, and four separately scored response-
under-uncertainty scenarios. Partnership is no longer mixed into the attraction classifier.

**Balance.** The comparative blocks use a balanced incomplete-block design. Each of the eight
scoring dimensions appears exactly eight times, and every possible pair of dimensions appears
together three or four times. This equalizes score opportunity and varies opponents rather
than repeatedly matching the same motives against one another.

**Provisional scoring.** A best choice contributes +1 and a least choice contributes -1 to
their respective dimensions. Seven-point anchors map linearly from -1 through 0 to +1. The
pilot scorer exposes comparative and absolute evidence separately, plus a clearly marked
unstandardized mean for research inspection. It does not assign an archetype. Development-
sample standardization, prototype fitting, and hold-out validation are required before any
v3 production decision rule is added.

**Pilot collection flow.** A separate `/spec-test/pilot` page is available only when
`SPEC_TEST_V3_PILOT_ENABLED=true`. It starts with explicit research consent, supports all three
question types, randomizes comparative and uncertainty option order, resumes a versioned local
draft, permits back/skip, preserves answers after a save failure, and ends with a research-only
thank-you rather than a fabricated archetype result. The live `/spec-test/quiz` remains v2.2.

**Interaction accessibility.** Best–worst uses explicit Most and Least buttons and prevents
the same option occupying both poles. Intensity and uncertainty use native radio controls.
Controls are keyboard operable, retain visible labels and focus states, do not rely on color
alone, and have touch targets at least 44px high.

**Storage and consent boundary.** The dedicated pilot endpoint and page share the same server-
side feature flag. Submission requires the exact versioned consent value and complete,
validated item records. `SpecTestPilotSubmission` stores raw responses, separate attraction
and uncertainty profiles, quality flags, and an 80/20 development/hold-out tag. The table has
no profile or email relation; pilot rows cannot become public results or ranking inputs.

**Pilot analytics.** `SpecTestPilotAttempt` records only an anonymous client-generated attempt
id, consent/instrument versions, and the highest completed question. Monotonic updates prevent
out-of-order requests from making progress move backward. The admin dashboard shows the real
completion funnel, quality flags, split counts, motive means/SD/ranges, development-versus-
hold-out means, and item-level best/least, rating, choice, skip, timing, and position data.
Quality-flagged submissions remain in operational and item diagnostics but are excluded from
motive summaries that might later influence model fitting.

**Predeclared review gates.** The dashboard now separates insufficient evidence from a failed
criterion. Modeling review requires 375 quality-clean completions: 300 development plus 75
untouched hold-out. Once 50 starts/submissions exist, completion must be at least 70% and the
flagged-submission rate at most 15%. Automatic review warnings cover excessive skipping,
dominant options, position effects, intensity endpoint pile-ups, compressed motive variance,
and development/hold-out drift. A passing state means “ready for modeling review,” never
“validated” or “ready to launch.”

**Research export.** Superadmins can download one de-identified long-form analysis CSV. The
query is restricted to the exact instrument and consent versions. It includes item-level
choices plus provisional scores but excludes submission/attempt ids, identity fields, exact
timestamps, IP addresses, and free text; elapsed time is rounded, participant order is
shuffled for each export, caching is disabled, and the download is audit-logged.
