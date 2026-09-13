# Spec Test v2 — Implementation Plan

**Status:** Draft for approval
**Instrument version target:** `spec-v2.0`
**Source of truth for design:** [`docs/spec-test-research.md`](./spec-test-research.md) (referenced below as §)
**Superseded design doc:** [`docs/spec-test-quiz.md`](./spec-test-quiz.md) (v1 — kept for provenance of the eight narratives)

---

## 1. What this plan covers

The research report replaces the v1 instrument entirely: a different number of underlying
dimensions, a different item bank, a different scoring method, a different result structure,
and a different set of claims the product is allowed to make. This document translates that
into buildable, reviewable phases.

It is a plan, not a spec of record. Where the report leaves a decision open, this document
names it in [§13 Open decisions](#13-open-decisions) rather than quietly picking one.

### 1.1 The delta in one table

| Concern | v1 (shipped today) | v2 (target) | Report |
|---|---|---|---|
| Underlying dimensions | 6 hard-coded signed axes | 7 candidate motives + 2 intrigue facets, continuous 0–100 | §3 Layer A |
| Item count | 10 scored | 20 scored (+4 attachment scenarios, see D-1) + 3 optional context | §5 |
| Item structure | Flat list | 3 weighted sections: Spark ×1.25, Pattern ×1.00, Partnership ×1.15 | §5 |
| Scoring | Summed integer weights | Exposure-normalized motive scores, Mahalanobis-style centroid distance, softmax | §6.1 |
| Result | 1 archetype, winner-take-all | Primary + secondary, confidence label, Spark/Partnership split | §6.2 |
| Fallback | `grounded_equal` when nothing wins | **No fallback** — low-signal returns a retake prompt | §6.2, §12.3 |
| Interpretive layers | None | 8 lenses + attachment-response lens + relationship context | §3 Layers B/C/D |
| Copy | Static paragraph set per type | Modular, conditionally-gated, evidence-bearing | §7 |
| Long-term guidance | "What actually works for you" prose | Behavioral partner brief | §7, §12.10 |
| Stored per result | `specType` + 6 scores + answers | Full versioned payload (motives, facets, lenses, flags, confidence, quality) | §11 |
| Framing | "A playful, research-informed reading" | Same, plus explicit beta label + result disclaimer | §8, §9 |

### 1.2 Non-goals for v2.0

Explicitly **out of scope** for this build, to be revisited later:

- Matching users to each other on Spec scores. Requires separate consent and its own
  validation (§9). The current codebase deliberately keeps recommendations behavior-only
  (`lib/ranking/people-scoring.ts`), and this plan does not change that.
- Sociosexuality / sexual-history items (§2.6) — optional, age-gated and separately
  consented in the report; not needed for the free reading.
- Zodiac side note (§12.7) — zero scoring weight by definition, so it is pure UI delight and
  can ship any time after launch.
- Thurstonian IRT rescoring (§6.4) — needs pilot data that does not exist yet. Phase 7 builds
  the pipeline that makes it possible; it does not perform it.
- Re-scoring historical v1 results. Different items; mathematically impossible. See D-4.

---

## 2. Architectural principles

These follow directly from the report's central warning — that 7 motives and 8 archetypes are
**hypotheses, not findings** (§ Executive summary, §12.1, §12.2). The build must not harden
them into the code.

1. **Taxonomy is versioned data, not types.** The motive list, lens list, archetype set,
   centroids, α/σ/τ constants and item bank all live in versioned config modules keyed by
   `instrument_version`. Changing from 7 motives to 6, or 8 archetypes to 10, must be a
   config + copy change, never a refactor. No code may assume `MOTIVES.length === 7`.
2. **Scoring never reaches the browser.** v1 already enforces this by splitting
   `lib/spec-test-questions.ts` (client-safe prompts) from `lib/spec-test.ts` (`server-only`
   weights). v2 keeps that boundary and adds a test for it. Option→motive loadings, lens
   values and pattern-flag rules are all server-only.
3. **Every result is self-describing.** A stored result records the instrument version it was
   scored under, so old rows keep rendering correctly and calibration can segment by version.
4. **Claims are gated by evidence.** No sentence about a user's dating history renders unless
   its `requires` rule is satisfied by their actual answers (§7). This is enforced by the
   content-module system, not by author discipline.
5. **Confidence is reported, not hidden.** Blend and low-signal are first-class outcomes, not
   failure states to paper over (§6.2).
6. **Legacy compatibility is non-negotiable.** Result URLs are shared publicly; every already-
   issued `/spec-test/result/[id]` link must keep working.

---

## 3. Current-state inventory

Everything that will need to change, and how much.

| File | Role today | v2 impact |
|---|---|---|
| `lib/spec-test.ts` | server-only: 6 dimensions, answer weights, 8 centroids, cosine match, 8 static readings, lead queries, signup linking | **Split & rewritten.** Becomes `lib/spec-test/` directory |
| `lib/spec-test-questions.ts` | client-safe 10-question bank | **Replaced** by versioned item bank |
| `app/api/spec-test/submit/route.ts` | validates 10 answers, scores, persists | **Rewritten** for the new response payload |
| `app/api/spec-test/result/[id]/email/route.ts` | attaches email + consent, sends copy | Minor — reads a richer reading |
| `components/spec-test/quiz-flow.tsx` | age gate → 10 auto-advancing questions → submit | **Rewritten** — sections, back nav, skip, randomized options, timing capture |
| `app/spec-test/result/[id]/page.tsx` | static 5-section reading, per-type accent map | **Rewritten** to the 10-section progressive structure (§10) |
| `app/spec-test/page.tsx` | landing; copy says "10 … questions", "About 4 minutes" | Copy update (item count, beta label) |
| `components/emails/spec-test-result.tsx` | name + tagline + intro + link | Extended for primary + secondary |
| `lib/email/spec-test-notifications.ts` | sends the above | Signature change |
| `app/(admin)/admin/spec-test/page.tsx` | lead list | Extended with distribution + quality stats |
| `prisma/schema.prisma` (`SpecTestResult`, L1182) | `specType`, `scores`, `answers`, contact, consent | **Migration** — new columns |
| `components/spec-test/age-badge.tsx` | 18+ badge | Unchanged |
| `components/spec-test/email-capture-form.tsx` | optional email + consent switch | Unchanged |
| `middleware.ts` (L62–65) | keeps `/spec-test` + `/api/spec-test` public | Unchanged |
| `app/sitemap.ts` (L14) | lists `/spec-test` | Unchanged |
| `app/api/signup/route.ts` (L88), `lib/auth.ts` (L87) | `linkSpecTestResultIfConsented` on account creation | Unchanged (still bookkeeping only) |
| `components/admin/admin-shell.tsx` (L26) | admin nav entry | Unchanged |

**Test coverage today: none.** No `__tests__` file touches the Spec Test. Phase 1 changes that
before any behavior is rewritten.

---

## 4. Target module layout

`lib/spec-test.ts` becomes `lib/spec-test/`. Because TypeScript resolves `@/lib/spec-test` to
`lib/spec-test/index.ts`, **every existing import keeps working unchanged** — the signup and
auth call sites, the admin page and the email route need no edits for the move itself.

```
lib/spec-test/
  index.ts                      re-exports the public surface (keeps @/lib/spec-test imports valid)
  taxonomy.ts                   CLIENT-SAFE  motive/facet/lens ids + display names + INSTRUMENT_VERSION
  items/
    spec-v2.ts                  CLIENT-SAFE  item bank: prompts, option ids, option labels, section
    index.ts                    CLIENT-SAFE  version -> bank lookup
  scoring/
    loadings.ts                 server-only  option -> motive λ, lens values, flag contributions
    archetypes.ts               server-only  centroids, α, σ, τ, archetype set per version
    score.ts                    server-only  normalization, distance, softmax
    decide.ts                   server-only  clear / blend / split / low-signal rules
    quality.ts                  server-only  speed, straight-lining, contradiction, skips
  interpretation/
    modules.ts                  server-only  content table with requires/excludes/claimStrength
    compose.ts                  server-only  assembles the result payload (§7 module table)
    readings/                   server-only  per-archetype narrative fragments (from §4)
  results.ts                    server-only  persistence read/write, legacy v1 rendering
  leads.ts                      server-only  getSpecTestLeads, linkSpecTestResultIfConsented (moved as-is)
```

The `taxonomy.ts` / `items/` split from `scoring/` is the same client/server boundary v1
already draws between `lib/spec-test-questions.ts` and `lib/spec-test.ts`, made explicit.

---

## 5. Data model

Additive migration. `specType` is **kept and keeps meaning "the primary spec"** for both v1
and v2 rows — that way the admin page, the email route and `getSpecTestLeads` need no change,
and legacy rows stay valid without backfill.

```prisma
model SpecTestResult {
  id                String   @id @default(cuid())
  /** Primary spec. v1 and v2 both write this, so legacy readers keep working. */
  specType          String
  /** Which instrument scored this row. Existing rows default to v1. */
  instrumentVersion String   @default("spec-v1")

  /** v1: the six raw dimension scores. v2: unused (see motiveScores). Kept for provenance. */
  scores            Json
  /** v1: { questionId: "A" }. v2: responses with option ids, presented order, elapsed ms. */
  answers           Json

  // --- v2 only, null on legacy rows ---
  secondarySpec     String?
  /** 0-100 per motive, plus the two intrigue facets. */
  motiveScores      Json?
  /** 0-100 per interpretive lens, plus the attachment-response tendency. */
  lenses            Json?
  /** e.g. ["ambiguity_amplification"] - gates conditional copy. */
  patternFlags      String[] @default([])
  /** clear | blend | split | low_signal */
  resultConfidence  String?
  /** usable | low_signal */
  responseQuality   String?
  /** Optional relationship-context answers. Interpretation only, never scored. */
  contextAnswers    Json?

  email             String?
  profileId         String?
  profile           Profile? @relation(fields: [profileId], references: [id], onDelete: SetNull)
  consentMarketing  Boolean  @default(false)
  createdAt         DateTime @default(now())

  @@index([email])
  @@index([profileId])
  @@index([instrumentVersion, specType])   // calibration + admin distribution queries
}
```

**Also drop `phone`.** It exists in the v1 table and is written by nothing. Per the report's
data-minimization requirement (§9) an unused contact column should not survive a redesign.

**Per-item timing** lives inside the `answers` payload rather than its own column — it is only
ever read in bulk for calibration, never queried individually:

```jsonc
{
  "instrumentVersion": "spec-v2.0",
  "responses": [
    { "itemId": "s01_crowded_event", "optionId": "s01_i_depth", "presentedIndex": 2, "elapsedMs": 4130 },
    { "itemId": "s02_first_date",    "optionId": null,          "presentedIndex": null, "elapsedMs": 9022, "skipped": true }
  ]
}
```

Storing `optionId` rather than `"A"`/`"B"` is required: with randomized option order (§5
item-writing rules) a letter no longer identifies an answer. `presentedIndex` is what makes
position-bias and straight-lining analysis possible.

---

## 6. Phase 1 — Instrument core

**Goal:** the complete v2 scoring engine as pure, tested, server-only functions. No UI, no DB,
no route changes. Nothing user-visible ships in this phase.

**Why first:** the engine is the part most likely to be wrong, and the only part that can be
exhaustively tested without a browser or a database.

### Deliverables

- `lib/spec-test/taxonomy.ts` — 7 motives (W, R, V, A, C, N, I) with `I` carrying the two
  candidate facets `contained_depth_privacy` and `aesthetic_selectivity` kept **separate
  throughout**, per §3 Layer A's explicit instruction that pilot data must decide whether they
  merge. 8 lenses from §3 Layer B. `INSTRUMENT_VERSION = "spec-v2.0"`.
- `lib/spec-test/items/spec-v2.ts` — the item bank, authored from the §5 prototype set:
  stable `itemId`, stable `optionId` per option, section (`spark` | `pattern` | `partnership`),
  and the display prompt/label. **No weights in this file** — it is client-safe.
- `lib/spec-test/scoring/loadings.ts` — for each option: one primary motive at λ=1, zero to two
  secondary motives at λ=0.20–0.35 (§6.1), lens values in {−1, 0, +1} (§6.3), and any pattern
  flag contributions.
- `lib/spec-test/scoring/archetypes.ts` — the 8 provisional archetypes with numeric centroids
  in the new 7-motive space, plus α, σ and τ.
- `lib/spec-test/scoring/score.ts` — the §6.1 formulas.
- `lib/spec-test/scoring/decide.ts` — the §6.2 decision rules.
- `lib/spec-test/scoring/quality.ts` — the §6.2 low-signal detectors.
- `__tests__/lib/spec-test/` — the suite described below.

### The centroid-authoring problem (needs attention)

The report gives the archetypes only as **qualitative shapes** ("high I-depth, moderate W/C,
low public V" — §3 Layer A2). It supplies no numeric centroids, no α weights, no σ, no τ. Those
have to be authored, and if authored carelessly they will silently determine every result.

Proposed discipline:

1. Fix a public mapping from the report's qualitative words to numbers — e.g.
   `high = 80, moderate-high = 65, moderate = 50, low = 30, very low = 15` — and write every
   centroid using only those words, so each value traces to a line in §3 Layer A2.
2. Start with **α uniform (1.0)** and **σ uniform**, so no motive is silently privileged before
   there is data to justify it. σ becomes the observed per-motive standard deviation after the
   pilot (§6.4).
3. Tune **τ** against one target only: the share of respondents landing in `blend`. Pick a
   target band (suggest 20–35%) and set τ to hit it on synthetic and early real data. τ is a
   presentation dial, not a truth dial — document that in the file.
4. Record all of it in `docs/spec-test-instrument-changelog.md` with a version stamp, so a
   post-pilot refit is a diff and not an archaeology exercise.

### Acceptance criteria

- Every option in the bank has at least one motive loading; no orphan options, no loadings
  referencing an unknown motive or item.
- Motive scores are bounded 0–100, and a respondent who selects every option loaded on motive
  *k* scores exactly 100 on *k* (validates the exposure normalization denominator).
- Skipped items reduce the denominator rather than scoring zero — a partial response is
  normalized against what was actually shown and answered.
- Feeding each archetype's own centroid back in as a score vector resolves that archetype as
  primary.
- **No fallback:** an all-neutral, contradictory or heavily-skipped response returns
  `low_signal`. There must be no code path by which `grounded_equal` (or any archetype) is
  assigned because nothing else won (§12.3).
- Deterministic: identical responses produce an identical payload.
- Item-writing rules (§5) are enforced *by test*, not by review: option labels within a
  tolerance of each other in length; no motive occupying the same presented slot across the
  bank more than a set number of times; at least two tension/reverse items present.

### Tests

`__tests__/lib/spec-test/` — scoring normalization and bounds; centroid self-resolution;
blend detection at a near-tie; split detection when Spark and Partnership winners diverge;
low-signal triggers (speed floor, straight-lining, contradiction pair, skip ceiling);
no-fallback assertion; item-bank integrity (orphans, coverage, balance); loadings never
imported from a client-safe module.

**Risk:** hand-authored centroids are the single largest source of "the result feels wrong".
Mitigated by the discipline above plus the Phase 7 refit path — but it stays a known
limitation until the pilot runs, which is exactly why the product ships labelled beta (§8).

**Size:** L

---

## 7. Phase 2 — Persistence and API

**Goal:** v2 results can be computed, stored and read back. Legacy results keep rendering.

**Depends on:** Phase 1.

### Deliverables

- Prisma migration adding the §5 columns, dropping `phone`, adding the composite index.
- `app/api/spec-test/submit/route.ts` rewritten: accepts the response payload, validates every
  `itemId`/`optionId` against the versioned bank, rejects unknown or duplicate items, scores
  server-side, persists the full payload.
- `lib/spec-test/results.ts` — a single read model returning either a v1 or a v2 reading, so
  the result page and email never branch on version themselves.

### Acceptance criteria

- Every already-issued result URL renders exactly as it does today.
- A v2 row round-trips: submit → read → identical motive scores, lenses, flags, confidence.
- The route rejects a payload whose items do not match the declared `instrumentVersion`.
- Client bundles contain no loadings, centroids or τ. Enforced by the Phase 1 boundary test
  plus a build-output check.
- Rate limiting on submit — the endpoint is public (`middleware.ts` L62–65) and now writes a
  substantially larger row than v1.

**Size:** M

---

## 8. Phase 3 — Quiz experience

**Goal:** the taker can complete the new instrument, and we capture what calibration needs.

**Depends on:** Phase 1 (bank), Phase 2 (submit contract).

### Deliverables

`components/spec-test/quiz-flow.tsx`, rewritten. Doubling the item count changes the UX
requirements qualitatively — v1's auto-advance-with-no-way-back is tolerable over 10 taps and
is not over 20+.

- **Sections with interstitials.** Spark → Pattern → Partnership, each introduced briefly.
  Progress reads as section + position, not "8 of 24".
- **Back navigation.** Required at this length; changing an answer must re-open the item
  cleanly (v1's per-question `key` trick for focus retention carries over).
- **Skip.** Allowed on scored items (exposure normalization absorbs it) and on all context
  questions. Skips are counted toward the low-signal ceiling.
- **Randomized option order**, seeded per session, with `presentedIndex` recorded (§5).
- **Per-item elapsed time**, recorded for the speed detector.
- **Draft persistence.** A 20+ item quiz will lose people to accidental reloads. Persist
  in-progress answers to `localStorage`, keyed by instrument version, cleared on submit.
- **Context questions** (§5) at the end, visibly optional, visibly unscored.
- **Age gate retained**, with the §9 framing line added.

### Acceptance criteria

- Median completion within the ~4 minute budget (§5) on a mid-range phone — measured, not
  assumed. If D-1 lands on 24 items and the measurement says ~5 minutes, the report's timing
  claim on the landing page changes to match rather than the measurement being ignored.
- Fully keyboard operable; `prefers-reduced-motion` respected (v1 already does this
  throughout — keep it).
- Reload mid-quiz resumes without data loss.
- Randomization never changes which option is which — `optionId` is what's submitted.

**Size:** L

---

## 9. Phase 4 — Interpretation engine

**Goal:** turn a scored payload into evidence-bearing copy, with the safety rails enforced
mechanically.

**Depends on:** Phase 1. Parallel with Phase 3.

### Deliverables

- `lib/spec-test/interpretation/modules.ts` — the content table in the report's own shape
  (§11): `module_id`, `requires`, `excludes`, `claim_strength`, `copy`.
- A rules evaluator over motive scores, lenses, flags, confidence and quality.
- `compose.ts` — assembles the §7 result modules: headline spec, secondary influence, core
  pull, safety need, dating loop, strength, blind spot, long-term fit, growth prompt,
  confidence.
- The eight conditional dating-history rules from §7, each requiring **multiple** converging
  conditions.
- Per-archetype narrative fragments adapted from §4 (the report's rewritten readings supersede
  the v1 copy currently inlined in `lib/spec-test.ts`).
- Behavioral partner brief composition (§7, §12.10) — never "marry a Grounded Equal".

### Acceptance criteria

- **No module fires when `responseQuality = low_signal`.** Low-signal renders a retake prompt.
- Every dating-history module requires at least two converging conditions (§7).
- Every tentative claim carries a hedge ("your answers suggest", "you may recognize"). Tested
  by asserting no `claim_strength: tentative` copy contains an unhedged absolute.
- **Safety lint, as a test:** no module copy may contain clinical or diagnostic language
  (narcissist, trauma, abandonment, attachment disorder, codependent…), may rank types against
  each other, or may describe any type as more masculine/feminine/marriageable (§9).
- Snapshot tests over a set of synthetic profiles covering: clear primary, blend, Spark/
  Partnership split, low signal, and each archetype at least once.

**Size:** L

---

## 10. Phase 5 — Result page

**Goal:** the §10 progressive result experience.

**Depends on:** Phases 2 and 4.

### Deliverables

`app/spec-test/result/[id]/page.tsx`, rewritten to the ten-section structure: the Spec; why it
pulls you in; the twist (secondary or split); what it says about you; the dating loop
(conditional only); strength; blind spot; who tends to work for you; one experiment; share.

- The **Spark vs Partnership** module renders only on a split result (§6.2, §10).
- A **confidence line** renders honestly — "a close two-type blend" is shown, not hidden.
- The **§9 disclaimer** and a **beta label** appear on the page (§8 release standards).
- **Low-signal state**: an honest "these answers didn't give us a clear read" with a retake
  path, never a fabricated type.
- **Legacy v1 results** render their original reading, with a CTA to take the new version (D-4).
- The existing per-archetype accent map carries over; it is good and already scoped to small
  elements rather than the page shell.

**Size:** L

---

## 11. Phase 6 — Share, email, admin

**Goal:** the loop that makes it a lead-gen product, updated for the richer result.

**Depends on:** Phase 5.

- **Share card** — net new; the repo currently has no OG image generation at all, only a static
  `DEFAULT_OG_IMAGE` via `lib/seo.ts`. Generate per-result via `next/og`. **Headline type only.**
  No blind spot, no dating loop, no lens scores on the image (§10).
- **Email** — `components/emails/spec-test-result.tsx` extended to primary + secondary + the
  link. Stays transactional (the taker asked for it), so no unsubscribe link, consistent with
  the other transactional templates.
- **Admin** — `app/(admin)/admin/spec-test/page.tsx` gains type distribution, confidence mix
  (clear/blend/split/low-signal rates) and quiz drop-off by section. Drop-off by section is
  the metric that tells us whether 20+ items was the right call.

**Size:** M

---

## 12. Phase 7 — Calibration and validation tooling

**Goal:** make the report's validation roadmap (§8) executable. This phase builds the tooling;
it does not perform the research, most of which is people-work.

- **Item analytics** — choice frequency, position bias, skip rate, elapsed-time distribution
  per option (§8 Phase 3).
- **Consented export** — structured export of scored responses for psychometric analysis,
  restricted to rows where consent covers it, with an explicit admin capability gate.
- **Refit path** — because archetypes and centroids are versioned config (§2 principle 1),
  a post-pilot refit ships as `spec-v2.1` config plus copy, with old rows still readable.
- **Hold-out tagging** — development vs hold-out assignment at submit time, so §8 Phase 3's
  replication requirement is possible after the fact rather than impossible.
- **Test–retest linkage** — the ability to connect two results from the same taker, for the
  2–4 week stability check (§8 Phase 3). Consent-gated.

Two warnings from the report to carry into this phase verbatim:

- **Do not optimize on "did this feel accurate?"** The Barnum effect (§2, §8 Phase 2) makes
  self-recognition an invalid primary metric.
- **Do not train scoring on engagement.** A model tuned for sharing rewards flattery, not
  accuracy (§8 Phase 4).

**Size:** M

---

## 13. Open decisions

These need your call before the phases they touch. Recommendations given, none of them locked.

**D-1 · Item count: 20 or 24?** The report is internally inconsistent here. §5 specifies 20
scored items and the prototype bank contains exactly 20. But §6.3 separately requires four
dedicated attachment scenarios — reassurance after delayed replies, response to rapid
closeness, conflict pursuit/withdrawal, comfort asking for support — and none of the 20
prototype items measure those. So either four Pattern items get replaced (losing motive
coverage) or the instrument is 24 items.
*Recommendation: author the four attachment items as additions (24 total), measure real
completion time in Phase 3, and cut only if the data says to.* Blocks Phase 1.

**D-2 · Ship 8 archetypes?** The report says repeatedly not to lock to eight (§ Exec summary,
§12.2) but also supplies eight fully-written narratives (§4) and nothing else.
*Recommendation: ship the eight as provisional, with the set config-driven so the pilot can
merge, split or rename without a refactor.* Blocks Phase 1.

**D-3 · Allow skipping scored items?** §6.2 lists "too many skipped questions" as a low-signal
trigger, which implies skipping exists.
*Recommendation: allow it; exposure normalization handles a reduced denominator cleanly, and
forcing an answer manufactures noise. Cap at 3 skips before the result is low-signal.*
Blocks Phase 3.

**D-4 · What happens to existing v1 results?** They cannot be re-scored — different items.
*Recommendation: keep rendering them with their original reading, add a "this is the earlier
version, take the new one" CTA.* Blocks Phase 5.

**D-5 · Does the landing page keep the "about 4 minutes" claim?** It currently says 10
questions and ~4 minutes. If D-1 lands on 24, the honest number may be closer to 5.
*Recommendation: measure in Phase 3, then state whatever is true.* Blocks Phase 3.

**D-6 · Beta labelling scope.** §8 is explicit that "psychological assessment" is off-limits
until the validation record exists.
*Recommendation: "research-informed reading (beta)" on the landing page, quiz intro and result
page — not just buried in a footer.* Cross-cutting.

---

## 14. Cross-cutting requirements

Apply to every phase; verified at the end of each.

- **Honest framing.** The §9 disclaimer renders on the result. No copy anywhere claims the test
  is validated, diagnostic or predictive of destiny.
- **Safety boundaries (§9).** No clinical inference. No ranking types. No inferring sexual
  orientation from attraction answers. No protected attribute — race, tribe, religion,
  disability — used as a hidden weight anywhere. Enforced by the Phase 4 safety lint.
- **Data minimization (§9).** Store only what changes the result or is needed for consented
  calibration. `phone` goes. Context answers stay optional and visibly so. Deletion path works.
- **Consent separation.** Taking the quiz never opts anyone into marketing — v1's
  `consentMarketing` default-off behavior is correct and stays. A result must not be exposed to
  other users by default.
- **Accessibility.** Keyboard operability and reduced-motion support across the new quiz and
  result — v1 does this well throughout and it must not regress.
- **Instrument changelog.** `docs/spec-test-instrument-changelog.md`, appended on every change
  to items, loadings, centroids or constants.

---

## 15. Sequencing

```
Phase 1  Instrument core ─┬─ Phase 2  Persistence + API ── Phase 3  Quiz UX ─┐
                          │                                                  ├─ Phase 6  Share/email/admin
                          └─ Phase 4  Interpretation ──── Phase 5  Result ───┘
                                                                             └─ Phase 7  Calibration tooling
```

Phases 3 and 4 are independent of each other and can run in parallel once Phase 1 lands.
Phase 7 only needs Phase 2's schema, so it can start early if useful.

| Phase | Size | Ships anything user-visible? |
|---|---|---|
| 1 · Instrument core | L | No |
| 2 · Persistence + API | M | No |
| 3 · Quiz experience | L | Yes |
| 4 · Interpretation engine | L | No |
| 5 · Result page | L | Yes |
| 6 · Share, email, admin | M | Yes |
| 7 · Calibration tooling | M | Admin only |

Nothing is user-visible until Phase 3, and the product is not coherent until Phase 5 — so
Phases 3 and 5 should land close together, ideally behind one switch that flips the quiz from
v1 to v2 in a single step rather than leaving takers on a half-migrated instrument.

---

## 16. What "done" means for v2.0

- The eight archetypes are config, not code, and the pilot can change them without a refactor.
- No result is ever assigned by fallback.
- No sentence about a user's history renders without converging evidence behind it.
- A low-signal response is told so, honestly.
- Every result records the instrument that produced it.
- The product says it is a beta reading, and the copy nowhere claims more than the evidence
  supports.
