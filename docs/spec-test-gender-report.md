# Udala Spec Test: Gender Integration Report

## The question this report answers

**How should the Udala Spec Test accommodate whether the user is male or female, and where should gender be wired into the quiz, results and analysis?**

## Executive decision

Version 0.1 will ask only one demographic question:

> **What is your gender?**  
> Male / Female

Udala will then apply this routing rule:

| User response | Assumed attraction target | Test form |
|---|---|---|
| Male | Female | Female people-based stimuli and female result-language variant |
| Female | Male | Male people-based stimuli and male result-language variant |

There will be no additional question about whom the reading concerns and no relationship-status or relationship-intent question. Adult eligibility should be handled by Udala's 18+ entry or account gate, outside the psychological questionnaire.

This makes version 0.1 a deliberately heterosexual, binary-gender product. That is a product decision, not a scientific conclusion that gender determines attraction target. The limitation should be disclosed before the gender question:

> **Current test scope:** This version is designed for men attracted to women and women attracted to men.

The governing principle is simple:

> **Gender chooses the presentation form. Answers choose the Spec.**

Gender changes the people shown, nouns and pronouns used, and the subgroup in which test quality is evaluated. It must contribute zero points to the psychological score.

## 1. What research supports—and what is an Udala decision

### Research-supported principles

Sex, gender identity, sexual-orientation identity, attraction and behavior are related but distinct constructs. Measurement guidance cautions against treating one as a direct measurement of another.[^1] Therefore, male → female and female → male must be described internally as an **assumed routing rule**, not as a detected sexual orientation.

Research on partner preferences also warns against turning group averages into individual predictions. Men and women sometimes report different ideal priorities, but speed-dating research found that several familiar stated sex differences did not reliably distinguish attraction to people participants actually met.[^2] An individual user's answers should therefore outweigh demographic expectations.

Standard psychometric practice requires checking whether a test measures the same construct comparably across groups. Measurement invariance and differential item functioning are the relevant tools.[^3] This is especially important for Udala because male and female users will see different people-based images.

### Udala-specific product decisions

The following are not findings established by psychology; they are the chosen version 0.1 architecture:

- asking only gender;
- offering Male and Female as the in-scope responses;
- assuming women as the target for male users;
- assuming men as the target for female users;
- maintaining parallel female and male image banks;
- using gendered result-language variants;
- omitting relationship context from intake.

These decisions can produce a coherent first release, provided their scope is disclosed and their effects are tested.

## 2. Where gender enters the product

| Product layer | How gender should be used | How it must not be used |
|---|---|---|
| Entry | Select the male-to-female or female-to-male form | Pretend to have measured orientation |
| Questions | Render the appropriate people and pronouns | Change the psychological meaning of an option |
| Image stimuli | Show women to male users and men to female users | Give one gender more attractive or higher-status representations |
| Scoring | Record form identity for quality analysis | Add points or change weights because of gender |
| Spec selection | Permit every Spec for both genders | Reserve some Specs for men or women |
| Result copy | Adapt man/woman and he/she language | Insert gender stereotypes into the analysis |
| Dating-history reading | Use answer-derived pattern flags | Infer pursuit, provision or emotional style from gender |
| Marriage guidance | Recommend behavioral partner qualities | Tell women to marry providers or men to marry nurturers by default |
| Analytics | Compare form performance and fairness | Treat group differences as automatically biological |
| Validation | Test equivalent measurement across both forms | Validate one form and assume the other works |

## 3. User flow and routing

The final sequence should be:

1. Display the heterosexual version 0.1 scope notice.
2. Ask **“What is your gender?”**
3. Store `male` or `female`.
4. Derive the assumed attraction target.
5. Assign the relevant quiz form.
6. Deliver the same canonical questions using the appropriate text and visual variants.
7. Convert responses back to common motive and lens codes.
8. Calculate the result without a gender coefficient.
9. Choose eligible interpretation modules from the person's answers.
10. Render those modules using the appropriate gendered language.

The routing logic is:

```text
IF gender = male:
    assumed_attraction_target = female
    quiz_form = female_stimulus_v0_1

IF gender = female:
    assumed_attraction_target = male
    quiz_form = male_stimulus_v0_1
```

The scoring logic remains:

```text
Spec profile = f(scored answers)
Gender contribution to motive scores = 0
Gender use = form routing + language rendering + quality analysis
```

## 4. Question architecture

### One canonical question, two surface variants

Each item should exist as a canonical psychological object. The male and female forms should change only what is required to make the attraction target coherent.

Canonical item:

> Someone you are interested in cancels a plan. Which response would preserve your attraction?

Male-user variant:

> A woman you are interested in cancels a plan. Which response from her would preserve your attraction?

Female-user variant:

> A man you are interested in cancels a plan. Which response from him would preserve your attraction?

All three versions must map to the same option IDs, motive weights and interpretive lenses. Do not write two independent tests and attempt to make them similar afterward.

### Gender must not rewrite the motive

The constructs retain the same meaning:

- **Warmth and Responsiveness:** affection, emotional presence and reassurance in both men and women.
- **Reliability and Reciprocity:** fairness, follow-through and shared responsibility in both.
- **Social Vitality:** expressive confidence, play and social energy in both.
- **Agency and Direction:** competence, purpose and initiative in both—not “male provider” versus “stylish woman.”
- **Cognitive Play:** wit, curiosity and mental stimulation in both.
- **Novelty and Autonomy:** expression, adventure and independence in both—not sexual availability.
- **Intrigue and Selective Access:** restraint, depth and gradual reveal in both—not emotional dysfunction.

### No gender-triggered psychological claims

Rules such as these are prohibited:

```text
IF gender = male THEN increase Beautiful Mystery
IF gender = female THEN increase Ambitious Icon
IF gender = male THEN describe him as commitment-avoidant
IF gender = female THEN describe her as reassurance-seeking
```

If Udala wants to discuss pursuit, provision, dominance, nurturance, traditional roles or independence, the relevant preference must be measured through an answer. It cannot be inferred from gender.

## 5. Visual-stimulus system

Gender has its largest practical effect on scored visual questions. Each people-based option requires parallel female and male forms.

### Equivalent visual sets

If an item presents four women to a male respondent, the corresponding female-user item should present four men communicating the same four psychological signals.

Match the two versions on:

- apparent age;
- facial expression;
- eye contact;
- pose and camera distance;
- clothing formality;
- background and lighting;
- perceived social status and wealth;
- body visibility;
- sharpness and production quality;
- baseline attractiveness;
- strength of the intended psychological cue.

A tailored male executive in a luxury office is not equivalent to a casually photographed woman if both are supposed to represent ambition. The setting itself adds status cues and contaminates the result.

### Use multiple exemplars

One face must not permanently represent one Spec. If the same especially attractive model always represents Quiet Fire, some users will select the face rather than the intended energy.

For each motive and target gender, create several adult models with varied:

- facial features;
- skin tones;
- hairstyles;
- body types;
- clothing styles;
- expressions and settings.

Rotate these exemplars across questions and respondents while retaining the same canonical motive key. The first pilot should record the exact asset ID shown so Udala can detect whether one model is driving responses.

### Pretest images separately

Before using an image as a scored stimulus, ask a separate sample to rate it on the intended cues—for example warmth, confidence, restraint, sociability, polish or adventurousness. Do not show the Spec names.

An image should be revised or removed when:

- raters do not perceive the intended quality;
- the male and female equivalents differ substantially in perceived attractiveness;
- unintended wealth, sexuality or age signals dominate;
- one asset produces unusual choices unrelated to its intended motive.

If equivalent people-based visuals cannot be produced reliably, use text scenarios for scoring and reserve portraits for decoration.

## 6. Scoring and classification

Gender is not a psychological predictor in the scoring equation:

$$
M_k = 100 \times \frac{\sum_i w_i\lambda_{i,a_i,k}}{\sum_i w_i\lambda^{\max}_{i,k}}
$$

The equation uses the chosen answers, question weights and answer-to-motive mappings. It contains no male/female term.

The following must remain identical across gender forms:

- canonical option IDs;
- motive mappings;
- base weights;
- archetype centroids;
- primary/secondary thresholds;
- blend thresholds;
- confidence rules;
- low-signal rules.

A male and female respondent giving equivalent answers should receive equivalent scores and the same headline Spec. Grounded Equal, Soft Landing, Ambitious Icon and every other result must be equally available to both.

Separate gender-specific scoring tables should not be introduced merely because result frequencies differ. First investigate sampling, image equivalence, cultural interpretation and item bias. Different calibrations should be a last resort supported by strong evidence—not a way to preserve expected stereotypes.

## 7. How gender affects the result page

### What changes

Gender can change:

- `woman/women` versus `man/men`;
- `she/her` versus `he/him`;
- which approved partner image accompanies the result;
- gender-relevant examples that do not alter the psychological claim.

### What remains constant

The result's meaning, strengths, blind spots, dating loop and partner guidance remain answer-driven.

Canonical Quiet Fire copy:

> You are drawn to people whose intensity is contained rather than advertised. Privacy catches your attention, but basic interest still needs to become visible if the connection is going to work.

Male-user rendering:

> You are drawn to women whose intensity is contained rather than advertised. A woman's privacy can catch your attention, but her basic interest still needs to become visible if the connection is going to work.

Female-user rendering:

> You are drawn to men whose intensity is contained rather than advertised. A man's privacy can catch your attention, but his basic interest still needs to become visible if the connection is going to work.

The gendered variants introduce no new psychological information.

### Dating-history modules

Gender alone must never produce statements such as:

- “As a man, you always want what you cannot have.”
- “You choose successful men because you need security.”
- “Men like you struggle to express emotion.”
- “Women like you fall too quickly.”

A dating-history statement should require answer-based conditions. Example:

```text
requires:
  intrigue >= 65
  reassurance_sensitivity >= 60
  repeated ambiguity choices >= threshold

copy:
  "You may recognize a pattern in which uncertain attention occupies more mental space than steady interest."
```

Male and female editions may change the target nouns, but not the eligibility rule.

### Long-term partner guidance

Do not tell a woman to marry an Ambitious Icon or tell a man to marry a Soft Landing because of gender. Generate a behavioral brief from the respondent's Spark, Safety and Partnership scores:

> The person most likely to suit you long-term is emotionally direct without being invasive, self-possessed without becoming unavailable, and consistent enough that privacy never becomes confusion.

This guidance can be rendered as “the woman” or “the man,” but its substance comes from the scores.

## 8. Content-engine requirements

Maintain one canonical analysis library with limited rendering variants:

```json
{
  "module_id": "qf_ambiguity_02",
  "eligibility": {
    "primary_spec": "quiet_fire",
    "intrigue_min": 65,
    "reassurance_sensitivity_min": 60
  },
  "canonical_copy": "You may become more mentally occupied when someone's interest is difficult to verify.",
  "male_user_copy": "You may become more mentally occupied when a woman's interest is difficult to verify.",
  "female_user_copy": "You may become more mentally occupied when a man's interest is difficult to verify."
}
```

The gendered fields are presentation variants, not separate interpretations. Every new module should pass three checks:

1. Would the psychological claim remain true if the genders were reversed?
2. Is the claim supported by scored answers rather than the demographic field?
3. Does one variant sound more flattering, sexualized, moralized or pathologizing than the other?

## 9. Data model and privacy

Store the routing assumption explicitly:

```json
{
  "instrument_version": "spec-v0.1",
  "gender": "male",
  "routing_rule": "heterosexual_v0_1",
  "assumed_attraction_target": "female",
  "quiz_form": "female_stimulus_v0_1",
  "gender_used_in_scoring": false,
  "primary_spec": "quiet_fire",
  "secondary_spec": "brilliant_tease"
}
```

Do not store `sexual_orientation: heterosexual` because the user did not state it. `assumed_attraction_target` documents what the product did; it does not claim what the user is.

Also store:

- question and option IDs;
- exact image asset IDs shown;
- scoring-model version;
- result-copy version;
- completion time;
- response-quality and confidence flags.

Gender and attraction-pattern responses are sensitive. Explain the purpose of the gender question, restrict internal access, provide deletion controls and do not make the answer or private reading visible on a public profile without separate consent.

## 10. Analytics plan

Analyze the following by male and female form:

| Metric | What it reveals |
|---|---|
| Start-to-completion rate | Whether one form is harder or less engaging |
| Item completion time | Confusing or uncomfortable questions |
| Option distribution | Dead, dominant or socially undesirable answers |
| Asset-level selection rate | Whether a particular model drives choices |
| Motive reliability | Whether each motive is measured consistently |
| Result distribution | Unexpected clustering or missing archetypes |
| Blend and low-signal rate | Whether one form produces less decisive readings |
| Retest stability | Whether results remain reasonably consistent |
| Share and save rate | Product resonance—not psychological validity |
| External-choice prediction | Whether scores relate to independent attraction choices |

Do not assume a male/female difference is innate. It may reflect sample composition, social norms, the language used, the models selected, photographic treatment or a genuinely different average preference. The analysis must test these alternatives before changing the scoring system.

## 11. Validation plan

### Stage 1: expert review

- Have relationship-science and psychometric reviewers inspect every canonical item.
- Have independent reviewers compare male and female variants for construct equivalence.
- Flag gender stereotypes and culturally loaded signals.

### Stage 2: cognitive interviews

- Conduct approximately 12–20 interviews per form before the large pilot.
- Ask participants what each option and image communicates to them.
- Include Nigerian men attracted to women and Nigerian women attracted to men across age and social-background ranges.
- Check culturally specific meanings of ambition, modesty, provision, respect, independence, sexuality and marriage.

### Stage 3: visual pretesting

- Rate intended traits and unintended cues for every asset.
- Remove images that are unusually attractive or status-loaded relative to their set.
- Confirm that male and female equivalent sets communicate comparable motive signals.

### Stage 4: pilot calibration

- For the proposed minimum 600-person pilot, aim initially for approximately 300 respondents per form.
- Use development and hold-out samples.
- Record the form, item variant and asset version received.
- Collect richer comparison measures only in a separately consented research survey, not as public quiz questions.

### Stage 5: psychometric comparison

Test:

- whether the same factor structure fits both forms;
- reliability for every motive in each group;
- differential item functioning after controlling for the underlying motive;[^3]
- whether primary and secondary classifications remain stable;
- whether visual and text-only items behave differently;
- test–retest stability;
- prediction of independent profile or partner-trait choices.

If an item behaves differently across groups:

1. inspect its language and imagery;
2. check whether the intended cue differs;
3. rewrite or replace it;
4. retest it;
5. consider form-specific calibration only if meaningful differences remain and sufficient evidence supports it.

The objective is not identical percentages of each Spec among men and women. The objective is comparable measurement: equivalent levels of a motive should have equivalent score meaning.

## 12. Known limitation of the one-question design

Because Udala asks only gender, it cannot determine whether a user is gay, lesbian, bisexual or otherwise attracted outside the assumed route. A man attracted to men will receive female stimuli, and a woman attracted to women will receive male stimuli.

This limitation cannot be solved through scoring. It can only be addressed by:

- clearly restricting and disclosing version 0.1, as recommended here; or
- adding an attraction-target question in a future version.

The current plan chooses the first option. Udala should therefore avoid claims such as “for everyone” or “for all adults” when advertising this version of the test.

## 13. Implementation checklist

### Product

- [ ] Add the heterosexual-scope notice.
- [ ] Ask one gender question only.
- [ ] Remove attraction-target and relationship-context questions.
- [ ] Keep the 18+ gate outside the quiz.

### Content

- [ ] Create one canonical question bank.
- [ ] Create controlled male-user and female-user language variants.
- [ ] Keep every Spec available to both genders.
- [ ] Require answer-based eligibility for every strong reading claim.

### Visuals

- [ ] Build paired male and female stimulus sets.
- [ ] Use multiple adult models for every motive.
- [ ] Match age, attractiveness, status cues and photographic treatment.
- [ ] Pretest intended and unintended signals.
- [ ] Store the exact asset displayed to each respondent.

### Scoring

- [ ] Set gender weight to zero.
- [ ] Use common canonical motive mappings and centroids.
- [ ] Keep the same blend, confidence and low-signal rules.
- [ ] Do not add gender priors based on observed averages.

### Results

- [ ] Adapt only nouns, pronouns and equivalent examples.
- [ ] Keep strengths, blind spots and dating patterns answer-driven.
- [ ] Generate behavioral partner guidance rather than gender-role advice.
- [ ] Keep private vulnerabilities off share cards.

### Research and governance

- [ ] Recruit and validate both forms.
- [ ] Run image-equivalence tests.
- [ ] Test measurement invariance and differential item functioning.
- [ ] Audit every new content and asset version.
- [ ] Document the scope and limitations publicly.
- [ ] Do not store an inferred orientation as a user-provided fact.

## Final recommendation

The proposed male/female system can work cleanly if it is treated as **two presentation forms of one psychological model**:

- Male users receive women in attraction stimuli and female-focused result language.
- Female users receive men in attraction stimuli and male-focused result language.
- Both forms score the same seven candidate motives using the same underlying mappings.
- Gender does not push anyone toward or away from a Spec.
- Every dating-history and partner-suitability statement is earned by the person's answers.
- Differences between the two forms are investigated through validation rather than converted immediately into stereotypes or scoring bonuses.

The one-question design is simple, but it purchases that simplicity by limiting the first test to men attracted to women and women attracted to men. As long as Udala states that boundary honestly, keeps gender out of the score and validates both forms, the architecture is coherent and defensible.

## Sources

[^1]: National Academies of Sciences, Engineering, and Medicine. [*Measuring Sex, Gender Identity, and Sexual Orientation*](https://www.ncbi.nlm.nih.gov/books/NBK581037/). National Academies Press, 2022.

[^2]: Paul W. Eastwick and Eli J. Finkel. [“Sex Differences in Mate Preferences Revisited: Do People Know What They Initially Desire in a Romantic Partner?”](https://doi.org/10.1037/0022-3514.94.2.245) *Journal of Personality and Social Psychology* 94(2), 2008; Garth J. O. Fletcher, Jeffry A. Simpson, Geoff Thomas and Louise Giles. [“Ideals in Intimate Relationships.”](https://pubmed.ncbi.nlm.nih.gov/9972554/) *Journal of Personality and Social Psychology* 76(1), 1999.

[^3]: Daniel J. Bauer. [“A More General Model for Testing Measurement Invariance and Differential Item Functioning.”](https://doi.org/10.1037/met0000077) *Psychological Methods* 22(3), 2017.
