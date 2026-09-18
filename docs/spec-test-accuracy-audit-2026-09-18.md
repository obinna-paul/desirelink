# Spec Test accuracy audit and repair plan

**Date:** 2026-09-18
**Instrument reviewed:** `spec-v2.1`
**Status:** Critical scoring defect confirmed; do not interpret the present type distribution as a valid estimate of users' attraction archetypes.

## Implementation progress

- **2026-09-18 — Phase 0, analytics foundation complete.** Type distributions now require an
  explicit instrument version, form-level distributions apply the same version filter, all
  eight archetypes remain visible when their count is zero, and item analytics expose option
  wording plus count/choice rate. This slice changes observation only; it does not alter
  scoring or historical results.
- **2026-09-18 — Phase 1, scoring laboratory complete.** Added a deterministic, response-derived
  audit command (`npm run audit:spec-test`) covering exact score-space constraints, seeded null
  simulation, valid-answer archetype reachability, and one-answer perturbation stability. The
  baseline report raises `score_space_baseline_mismatch` and `null_distribution_collapse`; all
  eight archetypes are technically reachable, but their attainable margins and null access are
  severely unequal. Production scoring remains unchanged pending a versioned replacement.
- **2026-09-18 — Phase 2, `spec-v2.2` replacement classifier implemented.** New submissions use
  within-item forced-choice likelihood evidence centered and variance-standardized against
  random choice. Chance now maps to 50 in the displayed motive vector, skips omit evidence
  symmetrically, random patterns are withheld as insufficient signal, the authored
  contradiction rule is diagnostic rather than blocking, and a four-item Partnership section
  can no longer force a split. v2.0/v2.1 remain routed to their original classifier. On the
  seeded 5,000-response null audit, 90.14% are withheld and the remaining winners range from
  9.7% to 15.0% rather than collapsing 49.1% into Grounded Equal.
- **2026-09-18 — Phase 3, `spec-v3-pilot.1` measurement model scaffolded.** Added a separate,
  non-live 28-item pilot bank: 16 best–worst attraction blocks, eight independent seven-point
  intensity anchors, and four uncertainty scenarios. Every scoring dimension appears in
  exactly eight comparative blocks; every dimension pair appears together three or four
  times. Attraction and uncertainty now have separate response/scoring contracts. No v3
  archetype is emitted yet: prototypes and thresholds remain blocked on pilot data.
- **2026-09-18 — Phase 3 pilot collection flow complete behind a feature flag.**
  `/spec-test/pilot` now provides explicit research consent, all three accessible question
  interactions, random option presentation, back/skip behavior, versioned local draft resume,
  inline validation, retry-safe submission, and a research-only completion screen. Its API
  stores anonymous responses plus separate attraction/uncertainty profiles in
  `SpecTestPilotSubmission`, tags quality and development/hold-out split, and is unavailable
  unless `SPEC_TEST_V3_PILOT_ENABLED=true`. It creates no public Spec result and has no profile
  relation.
- **2026-09-18 — Phase 3 pilot analytics complete.** Added anonymous, monotonic progress
  telemetry that stores only the highest completed question, enabling a real consent-to-submit
  funnel without answers or identity. The admin dashboard now reports completion milestones,
  quality flags, development/hold-out counts, quality-clean motive distributions, and detailed
  best/least, intensity, uncertainty, timing, skip, and presentation-position diagnostics.
  Quality-flagged rows remain visible for item analysis but are excluded from motive summaries
  that could later inform fitting.

## Executive finding

The concentration in Grounded Equal and Soft Landing is primarily caused by a mismatch between the score space produced by the questionnaire and the score space used by the archetype centroids.

The current instrument is an eight-dimension, four-option forced-choice test. Across the 20 motive-scored items, each dimension is offered exactly ten times with identical total weighted exposure (`11.3`). A respondent selects only one dimension per item. Therefore every complete response has:

```text
total chosen section weight
= 8 Spark × 1.25 + 8 Pattern × 1.00 + 4 Partnership × 1.15
= 22.6

sum of eight reported motive/facet scores
= 100 × 22.6 / 11.3
= 200

mean score per dimension = 200 / 8 = 25
```

The hand-authored archetype centroids do not live in that space. Their sums range from 365 to 460, with means from 45.625 to 57.5. The distance matcher consequently rewards archetypes with the lowest overall centroid level, even before response shape is considered.

| Archetype | Centroid sum | Centroid mean | Squared scaled distance from the neutral forced-choice point (25 on every dimension) |
|---|---:|---:|---:|
| Grounded Equal | 365 | 45.625 | 14.9375 |
| Soft Landing | 385 | 48.125 | 16.4375 |
| Beautiful Mystery | 405 | 50.625 | 17.9375 |
| Quiet Fire | 425 | 53.125 | 19.4375 |
| Free Spirit | 425 | 53.125 | 19.4375 |
| Ambitious Icon | 445 | 55.625 | 20.9375 |
| Electric Charmer | 440 | 55.0 | 21.875 |
| Brilliant Tease | 460 | 57.5 | 23.375 |

That order closely predicts which results are common or absent. Grounded Equal is not a fallback in the code, but it behaves like one because its centroid is closest to the score manifold that the quiz can actually produce.

## Diagnostic simulation

A 100,000-response Monte Carlo check chose each of the four options with equal probability on every motive-scored item, then ran the exact production normalization and centroid-distance rules. This is a null-model diagnostic, not an estimate of the desired population distribution.

| Archetype | Null-model winner share |
|---|---:|
| Grounded Equal | 49.0% |
| Beautiful Mystery | 17.3% |
| Free Spirit | 13.2% |
| Soft Landing | 12.3% |
| Quiet Fire | 6.7% |
| Electric Charmer | 1.2% |
| Ambitious Icon | 0.2% |
| Brilliant Tease | 0.02% |

The reported live pattern—19 Grounded Equal, 8 Soft Landing, and 3 of one other type—is more concentrated than the null simulation, but it is directionally consistent with the mathematical bias plus the content bias described below.

Projecting the centroids into the attainable sum-200 space dramatically reverses the null distribution (for example, Ambitious Icon and Brilliant Tease become common and Grounded Equal becomes rare). This confirms the scale mismatch, but projection alone is **not** an acceptable production fix: it would replace one unvalidated distribution with another.

## Fault inventory

### P0 — The response vectors and archetype centroids are on incompatible scales

- `computeScoringVector` treats each dimension as the percentage of opportunities on which it was chosen.
- Because four dimensions compete in each item, the chance/neutral expectation is 25, not 50.
- The centroid authoring ladder defines unmentioned/moderate dimensions as 50, with high values at 65–80.
- Absolute squared distance with a uniform `SIGMA = 20` preserves the level mismatch and makes low-total centroids structurally easier to reach.
- `TAU` only changes how decisive the probabilities look. It cannot repair the ranking.

This is the main reason the distribution collapses.

### P0 — The tests validate impossible inputs instead of reachable answer profiles

The centroid self-resolution test feeds each numeric centroid directly into the matcher and confirms that it matches itself. It never establishes that a real set of forced-choice answers can produce that centroid or a nearby vector.

Required replacement tests must begin with valid item responses, score those responses, and then classify the resulting vector. At minimum they must cover reachability, null-response behavior, perturbation stability, and type-access parity.

### P1 — Social desirability is not balanced across options

Several items place emotionally healthy or morally admirable choices against exciting but risky choices. Examples include:

- `first-date-danger`: heart-to-heart or “zero performance” competes with last-minute novelty.
- `feel-chosen`: affection, future plans, and matching effort compete with privileged private access.
- `friend-introduction`: “mature, kind and genuinely ready” competes with focused, warm, or smart.
- `intimate-vulnerability`: asking for comfort, explaining a feeling, and owning a mistake compete with revealing something usually locked away.
- `forgivable-flaw`: choosing a harmful tolerance is scored as positive evidence for an attraction motive.

Warmth and reciprocity options often read as the safe or correct adult answer. Vitality, intrigue, and novelty options more often carry chaos, inconsistency, mystery, or emotional distance. This can push conscientious respondents toward Grounded Equal and Soft Landing even when the intended construct is attraction rather than moral judgment.

### P1 — The instrument mixes different constructs into one primary type

The same overall vector combines:

- immediate attraction;
- preferred partner traits;
- the respondent's own conflict/comfort behavior;
- tolerance of relationship flaws; and
- long-term partnership ideals.

Those are related but not interchangeable. Arbitrary section weights (`1.25`, `1.00`, `1.15`) cannot establish that they form one scale. The attachment items are correctly kept out of the motive vector, but other self-behavior and long-term-fit items are still blended into the primary archetype.

### P1 — “Split” is inferred from too little partnership evidence

The Partnership winner is computed from four questions. Each dimension appears in only two of those questions, so its section score can move in very coarse jumps. Any difference between the Spark winner and Partnership winner overrides the overall margin and labels the result `split`.

This is not a calibrated confidence decision. A four-item section does not support an eight-way standalone classification with known reliability.

### P1 — The probability and confidence values are presentation parameters, not calibrated probabilities

- The centroids are hand-authored from prose.
- `SIGMA = 20`, `TAU = 15`, and `CLEAR_MARGIN = 0.15` are provisional constants.
- The softmax values have not been calibrated against known labels, repeated testing, or held-out predictive outcomes.
- The current “clear”, “blend”, and “split” labels therefore describe internal score geometry, not measured correctness or certainty.

They should not be treated as accuracy estimates.

### P1 — The contradiction quality gate can reject truthful complexity

The two “tension pairs” are not repeated or reverse-keyed measurements of the same proposition. Preferring an agency-related compliment while wanting a warm introduction, or admiring an ambitious life while valuing a warm partnership, can be a coherent Spark/Partnership distinction. When both authored pairs meet the opposed-dimension rule, the submission is rejected as low signal.

This can selectively remove nuanced profiles and should be disabled until genuine consistency pairs exist and their false-positive rate is measured.

### P1 — Skips can distort relative scores

A skipped item removes exposure from four dimensions but not the other four. Up to three skipped items are allowed. Because scores are calculated against dimension-specific remaining exposure, which questions were skipped can change the relative scale even when the answered preferences are identical.

Skipping needs either model-based missing-data handling or a rule that withholds dimensions lacking enough evidence.

### P1 — The admin distribution combines instrument versions

The main type distribution groups all `SpecTestResult` rows only by `specType`. It combines legacy v1 and current v2/v2.1 results, even though those versions used different questions and scoring systems. The headline distribution therefore cannot diagnose the current instrument.

Every health metric must be segmented by `instrumentVersion`, with an optional form and date-range split.

### P1 — Existing analytics collect option frequencies but do not display them

The calibration function calculates `choiceRate` for every option, but the admin item table renders only completions, skips, time, and screen position. The most useful content-bias signal—whether one answer dominates an item—is invisible in the dashboard.

The dashboard also cannot show partial-completion drop-off because the quiz sends data only after all 24 questions have been traversed.

### P2 — Twenty-four advertised questions do not all contribute to the archetype

Four attachment-response scenarios affect attachment copy but not the primary archetype. The headline says 24 questions uncover the Spec, but the Spec classification uses 20. This is defensible only if the product clearly distinguishes the layers.

### P2 — Gender routing limits validity and sample representativeness

The flow offers only Woman and Man, then applies `heterosexual_v0_1`, assuming the attraction target is the opposite gender. It does not change scoring weights, but it prevents some users from receiving truthful wording and narrows who can complete the test as intended. The flow should ask who the respondent is evaluating or use neutral language. Gender should remain optional context, never a score input.

### P2 — The current sample is too small to estimate eight population prevalences

Thirty results are enough to detect the severe engineering bias above, but not enough to establish what the true archetype distribution should be. A healthy instrument does **not** need equal type shares. The goal is equal measurement access and validated classification, not a cosmetically uniform chart.

## Recommended repair

### Phase 0 — Contain and diagnose (1–2 days)

1. Keep the beta framing and avoid any accuracy claim.
2. Change admin distributions to require an `instrumentVersion` and show the version in the heading.
3. Display per-option choice rates and per-dimension score distributions (mean, SD, floor, ceiling).
4. Export a de-identified analysis snapshot of v2.1 responses under an explicit research/analytics basis. Do not reuse marketing consent as research consent.
5. Disable the authored contradiction rejection, or record it as a non-blocking diagnostic until false positives are known.
6. Freeze the current instrument as `spec-v2.1`; any scoring or item change must create a new version. Do not silently rescore old public results.

### Phase 1 — Build a scoring laboratory before changing production (2–4 days)

Add an offline/reproducible harness that reports:

- the exact attainable score constraints;
- archetype reachability from valid answer sets;
- null and latent-preference simulations;
- selection share by archetype under multiple plausible response models;
- winner changes after one-, two-, and three-answer perturbations;
- section-level reliability and Spark/Partnership split stability;
- item endorsement, skip, timing, and position bias;
- results by instrument version, quiz form, and cohort;
- a confusion/stability matrix for synthetic and later test–retest cases.

Do not use “all centroids resolve themselves” as the central correctness check. The required test is “valid responses representing the intended pattern resolve consistently.” Random or internally inconsistent answers should usually return insufficient confidence, not a default-looking type.

### Phase 2 — Separate what is being measured (product and content design, 1 week)

Use three distinct outputs:

1. **Attraction profile:** the traits/energy that create immediate and sustained pull. This determines the primary/secondary public archetype.
2. **Partnership profile:** the behaviors and conditions that support long-term fit. This produces a separate partner brief, not an eight-way classifier from four items.
3. **Response-under-uncertainty profile:** the attachment-adjacent behavioral lens. It remains ordinary-language context and never changes the archetype.

Do not combine these layers with arbitrary section multipliers. If the product keeps a Spark/Partnership “twist,” require independently reliable subscales and a calibrated difference threshold.

### Phase 3 — Rewrite the item model (recommended v3 pilot: 28 core responses, plus up to 2 adaptive tie-breakers)

Recommended pilot form:

- **16 balanced best–worst attraction blocks.** Each block shows four equally desirable, single-construct behaviors. The user selects “most magnetic” and “least magnetic.” Across the bank, each of the eight motives appears equally often and against varied opponents.
- **8 independent intensity anchors.** One clean rating per motive on a 5- or 7-point scale supplies absolute preference information that a purely forced-choice test cannot recover.
- **4 attachment/uncertainty scenarios.** Reported separately and not included in the archetype score.
- **0–2 adaptive tie-breakers.** Only when the top two attraction profiles remain too close; select items that maximally distinguish those candidates.

Partnership needs can be collected in a separate short module or in four additional optional items if completion data supports it. Accuracy takes priority over maintaining the existing “about five minutes” claim; measure the actual median and state it honestly.

Item-writing rules:

- keep all options equal in social desirability, specificity, length, and emotional intensity;
- never pit “healthy adult” against “exciting but harmful” unless risk tolerance itself is the named construct;
- avoid double-barrelled options such as kind **and** mature **and** ready;
- hold the frame constant within an item (all partner behavior, all attraction, or all self-response);
- include genuine repeated/reverse indicators for consistency checks;
- cognitively interview respondents about what each option meant to them before scoring it;
- counterbalance presentation order and opponent pairings.

### Phase 4 — Replace the scoring model

For the pilot:

1. Score best–worst choices as signed evidence (`most = +1`, `least = -1`) with balanced exposure.
2. Combine comparative evidence with the independent intensity anchors in a documented latent-score model.
3. Standardize dimensions using development-sample means and covariance; freeze those parameters by instrument version.
4. Fit or revise archetype prototypes in the same standardized space that responses occupy.
5. Use held-out data to calibrate decision boundaries and confidence. A softmax temperature must not be described as probability calibration.
6. Return primary + secondary motives when the data does not justify a stable archetype. Do not force every usable completion into one of eight names.
7. Derive public archetypes only where profile regions are stable, distinct, and narratively useful. Merge, split, or retire names when the data says so.

With a sufficiently large pilot, use a Thurstonian forced-choice model or multinomial item-response model rather than raw percentage chosen. Until then, a transparent signed and standardized prototype is preferable to false precision.

### Phase 5 — Validate before calling the result accurate

Suggested staged sample sizes and checks:

- **10–15 cognitive interviews:** comprehension, construct interpretation, and option desirability.
- **50–100 soft pilot:** completion, floors/ceilings, dominant options, missingness, and obvious item failures.
- **300+ development sample:** provisional factor/item model and archetype exploration. More is preferable for eight dimensions.
- **Independent hold-out (at least 20%):** confirm distribution, stability, and calibration without retuning.
- **2–4 week test–retest subset:** motive-score stability and primary/secondary stability.
- **Convergent/criterion checks:** partner-trait rankings, blinded profile choices, and later behavior where consent allows—not just “this sounds like me.”
- **Differential item functioning:** inspect gender/form, age band, location/culture, and other consented groups for item bias before interpreting group differences.

Provisional release gates should include acceptable subscale reliability, no extreme option dominance without substantive justification, replicated cluster/profile structure, tolerable retest stability, and no archetype that is reachable only through implausible answer patterns. Exact numeric gates should be set before examining the hold-out data.

### Phase 6 — Ship safely

1. Release as a new instrument version; preserve v1/v2.1 result pages as historical snapshots.
2. A/B the new flow only for completion and comprehension, never to train scoring toward engagement or sharing.
3. Monitor version-specific type distribution, motive distributions, confidence, item choices, completion/drop-off, and retake stability.
4. Show users their motive profile and secondary influence, not a single overconfident label.
5. Review after the first 50, 100, and 300 complete v3 responses using prewritten decision rules.

## Required regression tests

- Every scoring input used by the classifier must be producible by valid item responses.
- The response and centroid spaces must have the same baseline, scale, and covariance convention.
- Each intended archetype must be reachable from at least one content-reviewed answer pattern.
- Null/random responses must not collapse into one branded type; they should generally be low-confidence.
- A one-answer perturbation must not commonly flip clear results.
- Near-boundary profiles must render a blend/secondary result rather than false certainty.
- Spark/Partnership divergence must be stable under resampling before it is displayed.
- Skipping equivalent items must not systematically favor a type.
- Distribution queries must require `instrumentVersion`.
- Option-frequency analytics must be visible and tested.
- No gender, attraction-target wording, option order, or presentation form may alter scoring for identical semantic answers.

## Implementation map

- `lib/spec-test/scoring/score.ts`: replace the percentage-of-opportunities scale and model missingness explicitly.
- `lib/spec-test/scoring/archetypes.ts`: version and fit prototypes in the response model's actual standardized space.
- `lib/spec-test/scoring/decide.ts`: replace the four-item split override and calibrate uncertainty on hold-out data.
- `lib/spec-test/scoring/quality.ts`: remove pseudo-contradiction blocking; use real repeated-item evidence.
- `lib/spec-test/scoring/loadings.ts`: support signed/multi-indicator or best–worst evidence.
- `lib/spec-test/items/`: add a new versioned item bank; never mutate v2.1 ids or semantics in place.
- `lib/spec-test/admin-stats.ts`: segment every query by version and surface dimension/option analytics.
- `components/spec-test/quiz-flow.tsx`: support best–worst selection, explicit attraction-target/neutral wording, and adaptive tie-breakers.
- `__tests__/lib/spec-test/`: add response-derived reachability, null-model, stability, missingness, and version-segmentation tests.

## Decision

Do not try to repair the live distribution by lowering thresholds for Electric Charmer or Ambitious Icon, changing `TAU`, or adding type quotas. Those changes optimize the chart, not the truth.

The immediate engineering fix is to align the response and centroid spaces and make analytics version-specific. The durable product fix is to redesign the item model so attraction, partnership, and uncertainty are measured separately, then calibrate the public archetypes from real pilot data.

## Implementation progress — research review controls

The `spec-v3-pilot.1` dashboard now evaluates versioned, predeclared rules rather than asking
an administrator to interpret a small sample by eye. Modeling review remains locked until
there are at least **375 quality-clean completions: 300 development and 75 untouched hold-out**.
Completion and quality rates remain explicitly pending until 50 observations; after that,
completion must be at least 70% and submissions with one or more quality flags must be no
more than 15%. Passing these gates means the sample is ready for modeling review, not that the
instrument is accurate or ready for production.

Automatic warnings activate only after their own minimum sample sizes. They cover item skip
rates above 10%, a single four-option response above 55%, randomized-position shares above
40%, rating endpoint shares above 40%, motive SD below 0.15, and development/hold-out mean
differences of at least 0.35 on the provisional −1 to 1 scale. These are review triggers, not
automatic deletion rules. In particular, a hold-out warning must prompt an investigation;
it must never be used to tune parameters against the hold-out sample.

The superadmin analysis export is restricted by the existing `view_leads` capability and
selects only rows matching the exact pilot instrument and consent versions. Its long-form CSV
contains item choices, rounded response time, randomized position, provisional motive scores,
uncertainty counts, data split, and quality flags. It excludes database and attempt ids,
profile/email/IP fields, exact timestamps, and free text; participant order is shuffled for
each export and every download is written to the admin audit log.
