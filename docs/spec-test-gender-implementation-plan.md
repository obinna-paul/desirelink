# Spec Test — Gender Integration Implementation Plan

**Status:** Draft for approval
**Instrument version target:** `spec-v2.1` (see DG-3)
**Source of truth for design:** [`docs/spec-test-gender-report.md`](./spec-test-gender-report.md) (referenced below as §)
**Builds on:** [`docs/spec-test-v2-implementation-plan.md`](./spec-test-v2-implementation-plan.md) (Phases 1–7, all shipped)
**Related:** [`docs/spec-test-research.md`](./spec-test-research.md), [`docs/spec-test-instrument-changelog.md`](./spec-test-instrument-changelog.md)

---

## 1. What this plan covers

The gender report adds one demographic question and a presentation-form layer on top of the
shipped v2 instrument. Its governing principle:

> **Gender chooses the presentation form. Answers choose the Spec.**

Everything below serves that sentence. The scoring engine does not change at all — the work is
a routing layer, a copy-rendering layer, one new question, and analytics that can tell the two
forms apart.

### 1.1 The delta

| Concern | Today (v2.0, shipped) | Target (v2.1) | § |
|---|---|---|---|
| Demographic intake | None | One question: gender, Woman/Man | §Exec, §3 |
| Scope disclosure | Beta label only | Explicit heterosexual-scope notice before the question | §Exec, §12 |
| Attraction target | Never modelled | `assumedAttractionTarget`, derived by a named routing rule | §3, §9 |
| Item text | One gender-neutral string per option | One canonical template + per-form rendering | §4 |
| Result copy | One neutral string per field | Same strings, rendered per form | §7 |
| Scoring | No gender input | Unchanged — and now provably so, by test | §6 |
| Analytics | One population | Every metric cut by form | §10 |
| Stored row | No gender fields | gender, routingRule, assumedAttractionTarget, quizForm | §9 |

### 1.2 Non-goals

- **The entire visual-stimulus system (§5).** It assumes image-based scored items. This
  instrument has none — all 24 items are text scenarios. Paired image banks, multiple
  exemplars per motive, image pretesting, and per-asset ID tracking are all moot until
  someone decides to add image items, at which point §5 becomes a program of work in its own
  right, not a phase of this plan.
- **§11 Stages 1–4** (expert review, cognitive interviews, visual pretesting, pilot
  recruitment) are people-work, not code. This plan builds what those stages will need to
  read; it does not perform them.
- **An explicit attraction-target question.** §12 names this as the future fix for the
  one-question design's central limitation. Out of scope here by the report's own choice —
  but see DG-1, and see §2 principle 2 for why swapping it in later should be cheap.
- **Re-scoring or migrating existing v2.0 rows.** They have no gender and never will; they
  render neutral copy forever.

---

## 2. Principles

1. **Gender contributes exactly zero to the score, and we prove it mechanically.** Not
   asserted in a comment, not recorded as a `gender_used_in_scoring: false` field that could
   simply be wrong — proved by a test that runs the same answer set through both forms and
   asserts byte-identical motive scores, facets, lenses, archetype ranking, and confidence.
   This is the single most important acceptance criterion in the plan.
2. **The routing rule is named, stored, and swappable.** The report derives target from gender
   by an assumption. That assumption is config (`heterosexual_v0_1`), not logic sprinkled
   through the codebase. Replacing it later with a user-stated target is then a new rule plus
   a question — not a refactor. This is the same versioned-config principle the v2 plan's §2
   applied to the taxonomy.
3. **One canonical string, rendered — not three authored copies.** See DG-4. Mechanical
   rendering makes the two forms structurally identical apart from the gendered terms, which
   *guarantees* the report's §8 check 3 ("does one variant sound more flattering, sexualized,
   moralized or pathologizing than the other?") rather than leaving it to reviewer vigilance.
4. **Never store an orientation the user didn't state.** §9 is explicit. We store what the
   product assumed and why; we do not store a claim about the person.
5. **Null-safe throughout.** Every v2.0 row, and any future taker who somehow reaches a result
   without a form, renders the neutral canonical copy. No crashes, no blanks, no `{person}`
   leaking into the UI.

---

## 3. Current-state inventory

| File | Role today | Impact |
|---|---|---|
| `lib/spec-test/items/spec-v2.ts` | 24 items, neutral prompts/labels | **Templated** — gendered referents become tokens |
| `lib/spec-test/items/context-v2.ts` | 2 optional context questions | **Deleted** from the flow (DG-2) |
| `lib/spec-test/interpretation/readings-v2.ts` | 8 archetypes × 6 prose fields | **Templated** |
| `lib/spec-test/interpretation/pattern-flags.ts` | 8 rules + copy | **Templated** (copy only; rules untouched) |
| `lib/spec-test/interpretation/compose.ts` | Assembles the reading | Takes a form, renders on the way out |
| `lib/spec-test/results.ts` | v1/v2 read model | Passes the row's form into compose |
| `lib/spec-test/scoring/**` | Scoring engine | **No change** — and a new test proving it |
| `lib/spec-test/taxonomy.ts` | Instrument config | Version bump to `spec-v2.1` |
| `lib/spec-test/admin-stats.ts`, `calibration.ts` | Aggregates | Gain a `quizForm` dimension |
| `components/spec-test/quiz-flow.tsx` | Age gate → sections → items → context → submit | Gender step added, context step removed |
| `app/api/spec-test/submit/route.ts` | v1 + v2 submit | Accepts/validates/stores gender + routing |
| `app/spec-test/result/[id]/page.tsx` | Result page | Renders form-specific copy |
| `app/spec-test/result/[id]/opengraph-image.tsx` | Share card | Likely no change (archetype name + tagline carry no gendered referent) |
| `components/emails/spec-test-result.tsx` | Result email | Receives already-rendered copy |
| `app/(admin)/admin/spec-test/page.tsx` | Admin | By-form breakdowns |
| `prisma/schema.prisma` | `SpecTestResult` | 4 new nullable columns |

**Roughly 14 of 24 items** carry a gendered referent (a person, or a `they`/`their` about the
other person). The remaining ~10 — *"Which compliment would land deepest?"*, *"Choose the
Sunday you would want repeatedly."* — have no referent at all and need no variant. The report
anticipates exactly this: variants *"should change only what is required to make the attraction
target coherent."*

---

## 4. Target module layout

```
lib/spec-test/gender/
  forms.ts       CLIENT-SAFE  Gender/QuizForm types, the named routing rule, routeForm()
  terms.ts       CLIENT-SAFE  the approved token vocabulary + per-form term tables
  render.ts      CLIENT-SAFE  renderTerms(template, form) + authored-override registry
```

Client-safe because the quiz wizard renders item text in the browser. None of it touches
scoring, so none of it belongs behind the `server-only` boundary.

---

## 5. Data model

Four nullable columns on `SpecTestResult`, mirroring §9's JSON:

```prisma
  /** "male" | "female" - the taker's stated gender. Null on every pre-v2.1 row. */
  gender                  String?
  /** Which assumption mapped gender to a target, e.g. "heterosexual_v0_1". Stored so a
   *  future rule change is legible in the data rather than implied by a date range. */
  routingRule             String?
  /** What the product ASSUMED, never what the user declared. Deliberately not named
   *  `orientation` - see the gender report §9. */
  assumedAttractionTarget String?
  /** "male_user" | "female_user" - named for who took it, not for whose pictures they saw. */
  quizForm                String?
```

**Not stored:** `sexual_orientation` (§9 — the user never said it), and
`gender_used_in_scoring` (a self-declared boolean that could silently lie; principle 1's
invariance test is the real guarantee).

`Profile.gender` and `Profile.orientation` already exist on the main platform and are **not**
read or written here — the quiz is anonymous and public. See DG-1.

---

## 6. Phase G1 — Routing and rendering core

**Goal:** the routing rule and the copy-rendering layer, as pure tested functions. No UI, no
DB, no content changes.

### Deliverables

- `gender/forms.ts` — `Gender`, `QuizForm`, `ROUTING_RULE = "heterosexual_v0_1"`, and
  `routeForm(gender)` returning `{ quizForm, assumedAttractionTarget, routingRule }`.
- `gender/terms.ts` — the closed token vocabulary and its three term tables
  (`male_user`, `female_user`, `neutral`). Suggested starting vocabulary:
  `{person}` `{people}` `{they}` `{them}` `{their}` `{theirs}` plus capitalised forms.
  Neutral renders `person` / `people` / `they` / `them` / `their` / `theirs`.
- `gender/render.ts` — `renderTerms(template, form)`; unknown tokens throw in development and
  fall back to the neutral term in production rather than shipping `{braces}` to a user.
- **The invariance test** (principle 1), living in `__tests__/lib/spec-test/gender/`.

### Acceptance criteria

- **Scoring invariance:** for a fixed response set, `decideSpecTestResult` output is deep-equal
  across `male_user`, `female_user`, and no form. This is the report's governing principle,
  mechanically enforced.
- **Symmetry:** for every template in the codebase, rendering both forms and then replacing
  each form's gendered terms with a common placeholder yields two identical strings. A copy
  edit that makes one form warmer, softer, or more clinical than the other fails the build.
- No rendered output contains a leftover `{token}` in any of the three modes.
- Every token used anywhere is in the approved vocabulary; no ad-hoc tokens.
- `routeForm` is exhaustive over `Gender` and returns the rule name it applied.

**Size:** M

---

## 7. Phase G2 — Content pass

**Goal:** every user-visible string that refers to the other person becomes a template.

**Depends on:** G1.

### Deliverables

- **Items** (`items/spec-v2.ts`): tokenise the ~14 items with referents. Example:
  `"The quiet person clocking everything from the edge of the room."` →
  `"The quiet {person} clocking everything from the edge of the room."`
  Option IDs, loadings, sections, and weights are untouched — this is presentation only.
- **Readings** (`interpretation/readings-v2.ts`): 8 archetypes × 6 prose fields. The report's
  own worked example (§7) is a Quiet Fire core reading; that one restructures
  (*"their privacy"* → *"a woman's privacy"*), so it will need an authored override rather
  than pure substitution — exactly the case DG-4's hybrid exists for.
- **Pattern flags** (`interpretation/pattern-flags.ts`): copy only. **Eligibility rules must
  not change** — §7 is explicit that male and female editions may change target nouns but not
  the rule.
- **Override registry**: any string where substitution reads badly gets an authored per-form
  pair, recorded in one place so it can be audited as a set.

### Acceptance criteria

- The G1 symmetry test passes across the full content surface, not just fixtures.
- Every authored override has both forms present, is covered by the existing safety lint
  (no clinical/diagnostic/ranking language), and has both variants within a sane length ratio
  of each other — the crude proxy for "neither variant got more attention than the other."
- The three §8 questions are recorded per override: *would the claim survive gender reversal;
  is it answer-supported; does one variant read as more flattering/sexualised/moralised?*
- Item option IDs, loadings, and centroids are byte-identical to v2.0 (diff-checked).

**Size:** L — this is the bulk of the work, and it is authoring, not engineering.

---

## 8. Phase G3 — Persistence and API

**Goal:** a submitted result carries its gender and routing artifacts.

**Depends on:** G1.

### Deliverables

- Migration adding the four §5 columns.
- Submit route: accepts `gender`, derives the routing fields server-side via `routeForm`
  (never trusting a client-supplied `quizForm`), validates it against the declared instrument
  version, and stores all four.
- `results.ts`: reads the form back and hands it to compose.
- Instrument version registry: `spec-v2.1` registered alongside `spec-v2.0` so both banks
  resolve (DG-3).

### Acceptance criteria

- A v2.1 submission without a gender is rejected; a v2.0 submission is unaffected.
- `quizForm` is always server-derived. A client claiming `male_user` while sending
  `gender: female` gets the female-derived form, not the claimed one.
- Every pre-existing row still reads back and renders.
- The stored row never contains an orientation field.

**Size:** M

---

## 9. Phase G4 — Quiz experience

**Goal:** the taker sees the scope notice, answers one question, and gets the right form.

**Depends on:** G2, G3.

### Deliverables

Sequence per §3, fitted to the existing wizard:

1. Age gate *(existing — see DG-6)*
2. **Scope notice + gender question** *(new, one screen)*
3. Section intro → items *(existing, now rendered per form)*
4. ~~Context questions~~ *(removed — DG-2)*
5. Submit

- Scope notice copy, verbatim from §Exec: *"Current test scope: This version is designed for
  men attracted to women and women attracted to men."*
- A short purpose line for the gender question (§9 requires explaining why it's asked) —
  something like *"This only changes who the questions describe. It doesn't affect your
  result."* — which is literally true and is the honest version of the governing principle.
- Draft persistence extends to the chosen gender.
- Item rendering goes through `renderTerms` with the session's form.

### Acceptance criteria

- No scored item renders before the gender question is answered.
- Resuming a draft preserves the form; the taker is never re-asked.
- The two forms differ only in rendered terms — verified by driving the full quiz twice in a
  component test and diffing the rendered prompts.
- Landing-page copy still says 24 questions (the gender question is not a scored item).

**Size:** M

---

## 10. Phase G5 — Result surfaces

**Goal:** the reading reads correctly for the form that produced it.

**Depends on:** G2, G3.

- Result page renders composed copy for the row's form; v1 and form-less v2.0 rows render
  neutral copy unchanged.
- Email inherits it automatically (it already takes composed copy).
- Share card: expected no-op — archetype names and taglines carry no gendered referent —
  but verified rather than assumed.
- Long-term partner guidance stays behavioural (§7): *"the woman"* / *"the man"* is a
  rendering of a brief whose substance comes from scores, never gender-role advice.

**Size:** M

---

## 11. Phase G6 — Analytics and governance

**Goal:** the two forms can be compared, and the product says honestly what it is.

**Depends on:** G3.

- `admin-stats.ts` / `calibration.ts` gain a `quizForm` dimension: completion, item timing,
  option distribution, motive reliability inputs, result distribution, blend and low-signal
  rate — §10's table, minus the asset-level row (no assets exist).
- Admin page shows the by-form split with an explicit caution, per §10: a male/female
  difference is **not** evidence of an innate difference until sampling, language, and item
  bias have been ruled out.
- Public scope documentation (§13 governance): the limitation stated where takers can see it,
  and the marketing constraint that this version is not "for everyone."

**Not built:** the DIF / measurement-invariance analysis itself (§11 Stage 5). That is a
statistical study run on exported data — and the export is still blocked on the consent gap
documented in `lib/spec-test/calibration.ts`. Adding a *research* consent surface is the
prerequisite for both, and remains unbuilt.

**Size:** M

---

## 12. Open decisions

**DG-1 · The platform already models gender and orientation far more richly than this test.**
`lib/profile-options.ts` offers eight genders (including Non-binary, Trans woman, Trans man,
Genderfluid) and eight orientations (including Gay, Lesbian, Bisexual, Asexual). `Profile` has
both fields. This test would offer two genders and assume opposite-sex attraction. A Udala
member whose profile says *Non-binary* or *Lesbian* would meet a quiz with no option that fits
them — on a platform that already asked them and already knows.

The report's §12 treats "we can't tell who's gay or lesbian" as an unavoidable cost of the
one-question design. For anonymous takers that's true. For signed-in members it is partly
self-inflicted: the data exists.

*Recommendation: build exactly what the report specifies — it is a defensible v0.1 scope call
and the report argues the simplicity case well — but (a) keep the routing rule swappable per
principle 2 so an attraction-target question is a config change, and (b) make this decision
knowingly, because the inclusive vocabulary already shipped elsewhere in the product sets an
expectation this test will visibly break.* Blocks G1.

**DG-2 · The two context questions contradict the earlier research report.**
`docs/spec-test-research.md` §5 specified optional relationship-intent and current-chapter
questions; we built them in v2 Phase 3. The gender report §13 says to remove attraction-target
and relationship-context questions, and §Exec says there will be "no relationship-status or
relationship-intent question." These two source documents disagree.
*Recommendation: follow the newer report and remove them from the flow. They cost nothing to
drop — `contextAnswers` is stored but never read by any copy path today. Keep the column and
the existing rows.* Blocks G4.

**DG-3 · Version bump to `spec-v2.1`?**
Option IDs, loadings and centroids are unchanged, so the psychological instrument arguably
isn't new. But the taker's experience changed, and §11 Stage 5 wants per-form structural
comparison, which is cleanest when the exact bank is pinned.
*Recommendation: bump. Register both banks so `itemBankForVersion` and the analytics that take
a version argument keep resolving v2.0 rows.* Blocks G1.

**DG-4 · Token substitution or three authored strings?**
§8's JSON shows `canonical_copy` / `male_user_copy` / `female_user_copy` — three authored
strings. Substitution is cheaper, keeps one source of truth per string, and *guarantees* tonal
symmetry; authored variants read better where a sentence needs restructuring but can drift
apart in tone, which is precisely the failure §8 check 3 exists to catch.
*Recommendation: substitution-first, with a small audited override registry for the sentences
that genuinely need restructuring (the report's own Quiet Fire example is one).* Blocks G1.

**DG-5 · "Male / Female" or "Woman / Man"?**
The report writes the options as Male/Female. The platform's own profile vocabulary uses
Woman/Man.
*Recommendation: show Woman/Man to match the product; store `male`/`female` to match the
report's data model. Cosmetic, but consistency within one product is worth more than
consistency with a document.* Blocks G4.

**DG-6 · Age gate placement.**
§Exec says adult eligibility belongs at Udala's entry or account gate, "outside the
psychological questionnaire." Ours is the quiz component's first screen.
*Recommendation: leave it. It sits before any scored item, contributes nothing to scoring, and
is an entry gate in everything but file location. Moving it buys nothing.*

**DG-7 · Gender becomes account-linked on signup.**
`linkSpecTestResultIfConsented` attaches a consenting result to a new profile — so a stored
gender follows. Defensible (it's the taker's own answer, and linkage is already consent-gated),
but it should be a deliberate call in the §9 privacy review rather than a side effect nobody
noticed.

---

## 13. Cross-cutting requirements

- **Zero gender weight, proved by test** (principle 1) — re-verified at every phase, not just G1.
- **No gender-triggered psychological claims** (§4). The existing pattern-flag rules are
  answer-derived and must stay that way; extend the safety lint to fail on any eligibility
  rule that references gender, form, or target.
- **Every Spec available to both forms** (§6). Test it: no archetype is unreachable under
  either form.
- **Privacy** (§9): purpose explained at the point of asking, no public exposure of gender or
  reading, deletion path, restricted internal access.
- **Honest marketing** (§12): no "for everyone" / "for all adults" claims on this version.
- **Changelog discipline**: every content and rule change logged in
  `docs/spec-test-instrument-changelog.md`, as with v2.

---

## 14. Sequencing

```
G1 Routing + rendering core ─┬─ G2 Content pass ────┬─ G4 Quiz UX ──┐
                             │                      │               ├─ G6 Analytics + governance
                             └─ G3 Persistence/API ─┴─ G5 Results ──┘
```

G2 and G3 are independent once G1 lands. G4 and G5 both need G2+G3 and should ship together —
a taker routed to a form whose result page still renders neutral copy is a half-migrated
experience, the same trap the v2 plan's §15 flagged.

| Phase | Size | User-visible? |
|---|---|---|
| G1 · Routing + rendering core | M | No |
| G2 · Content pass | L | No |
| G3 · Persistence + API | M | No |
| G4 · Quiz UX | M | Yes |
| G5 · Result surfaces | M | Yes |
| G6 · Analytics + governance | M | Admin only |

---

## 15. What "done" means

- A test proves the same answers score identically under both forms. Gender cannot reach the
  score even by accident.
- The two forms' copy differs only in gendered terms — enforced, not reviewed.
- Every Spec is reachable from both forms.
- The row records what the product assumed and under which named rule, and never records an
  orientation the user didn't state.
- Every pre-gender row still renders.
- The scope limitation is stated where takers see it, and the marketing claims match it.
