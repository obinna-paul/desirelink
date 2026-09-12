import "server-only";

import { prisma } from "@/lib/prisma";
import { SPEC_TEST_QUESTIONS, type SpecTestOptionKey } from "@/lib/spec-test-questions";

export type { SpecTestOptionKey } from "@/lib/spec-test-questions";

// See docs/spec-test-quiz.md for the full product design conversation this
// implements: the six attraction dimensions, the ten scenario questions (each
// with the traits its own doc annotation says it measures), and the eight
// archetype readings, which are reproduced here verbatim as result copy.
//
// Question prompts/labels live in lib/spec-test-questions.ts, which the client-side
// quiz wizard also imports - this file adds the scoring weights on top and never
// ships to the browser, so how an answer is interpreted stays server-only.

export const SPEC_TEST_DIMENSIONS = [
  "warmthEdge",
  "stabilityAdventure",
  "understatedExpressive",
  "depthStatus",
  "familiarityContrast",
  "slowburnSpark",
] as const;

export type SpecTestDimension = (typeof SPEC_TEST_DIMENSIONS)[number];

/** Each dimension is a signed axis: negative leans toward the first pole, positive
 *  toward the second (e.g. warmthEdge: negative = Warmth, positive = Edge). */
export type DimensionVector = Record<SpecTestDimension, number>;

function zeroVector(): DimensionVector {
  return {
    warmthEdge: 0,
    stabilityAdventure: 0,
    understatedExpressive: 0,
    depthStatus: 0,
    familiarityContrast: 0,
    slowburnSpark: 0,
  };
}

// Translates each option into the traits the doc's own annotation says that question
// measures - e.g. Q1 "measures playfulness, mystery, social status and warmth." Keyed
// by "questionId.option" against the shared question list in spec-test-questions.ts.
const ANSWER_WEIGHTS: Record<string, Partial<DimensionVector>> = {
  "rooftop-party.A": { understatedExpressive: 2, slowburnSpark: 1 },
  "rooftop-party.B": { understatedExpressive: -2, warmthEdge: 1, slowburnSpark: -1 },
  "rooftop-party.C": { depthStatus: 2, understatedExpressive: 1 },
  "rooftop-party.D": { warmthEdge: -2, depthStatus: -1 },

  "movie-chemistry.A": { understatedExpressive: 1, warmthEdge: -1, depthStatus: -1 },
  "movie-chemistry.B": { slowburnSpark: 2, understatedExpressive: -1 },
  "movie-chemistry.C": { depthStatus: 2, familiarityContrast: 1 },
  "movie-chemistry.D": { depthStatus: -2, warmthEdge: -1, slowburnSpark: -2 },

  "someone-likes-you.A": { depthStatus: 1, warmthEdge: 1 },
  "someone-likes-you.B": { warmthEdge: -2, depthStatus: -1 },
  "someone-likes-you.C": { understatedExpressive: 2 },
  "someone-likes-you.D": { stabilityAdventure: -2, understatedExpressive: -1, slowburnSpark: -1 },

  "late-night-message.A": { stabilityAdventure: 2, slowburnSpark: 1 },
  "late-night-message.B": { depthStatus: -2, warmthEdge: -1 },
  "late-night-message.C": { understatedExpressive: 1, familiarityContrast: -1 },
  "late-night-message.D": { stabilityAdventure: -2, depthStatus: 1 },

  "couples-sunday.A": { understatedExpressive: 2, depthStatus: 1 },
  "couples-sunday.B": { warmthEdge: -2, stabilityAdventure: -1 },
  "couples-sunday.C": { stabilityAdventure: 2, familiarityContrast: 1 },
  "couples-sunday.D": { depthStatus: 1, stabilityAdventure: -1 },

  "compliment.A": { slowburnSpark: 1, depthStatus: 1 },
  "compliment.B": { warmthEdge: -2 },
  "compliment.C": { depthStatus: -2 },
  "compliment.D": { understatedExpressive: 2 },

  "instant-turnoff.A": { warmthEdge: 1 },
  "instant-turnoff.B": { warmthEdge: -1, depthStatus: -1 },
  "instant-turnoff.C": { stabilityAdventure: 2, slowburnSpark: 1 },
  "instant-turnoff.D": { depthStatus: 2 },

  "weekend-home.A": { depthStatus: 2 },
  "weekend-home.B": { warmthEdge: -1, understatedExpressive: -2 },
  "weekend-home.C": { understatedExpressive: 2, stabilityAdventure: 1 },
  "weekend-home.D": { understatedExpressive: -1, slowburnSpark: -1 },

  "disagreement.A": { warmthEdge: 1, understatedExpressive: -1 },
  "disagreement.B": { understatedExpressive: 2 },
  "disagreement.C": { warmthEdge: -2, depthStatus: -1 },
  "disagreement.D": { depthStatus: -2, warmthEdge: 1 },

  "remember-first.A": { slowburnSpark: 2, depthStatus: 1 },
  "remember-first.B": { depthStatus: -1, warmthEdge: -1 },
  "remember-first.C": { understatedExpressive: 2 },
  "remember-first.D": { warmthEdge: -2, slowburnSpark: -2 },
};

const QUESTION_IDS = SPEC_TEST_QUESTIONS.map((question) => question.id);

export type SpecTypeKey =
  | "quiet_fire"
  | "soft_landing"
  | "electric_charmer"
  | "ambitious_icon"
  | "brilliant_tease"
  | "beautiful_mystery"
  | "free_spirit"
  | "grounded_equal";

// Each archetype's target position in the same 6D space, hand-derived from its
// description in docs/spec-test-quiz.md. Matching is by cosine similarity, so only
// the relative shape of each vector matters, not its absolute scale.
const SPEC_TYPE_CENTROIDS: Record<SpecTypeKey, DimensionVector> = {
  quiet_fire: { warmthEdge: 1, stabilityAdventure: -1, understatedExpressive: -2, depthStatus: -1, familiarityContrast: 0, slowburnSpark: -1 },
  soft_landing: { warmthEdge: -2, stabilityAdventure: -1, understatedExpressive: -1, depthStatus: -1, familiarityContrast: -1, slowburnSpark: -1 },
  electric_charmer: { warmthEdge: 0, stabilityAdventure: 1, understatedExpressive: 2, depthStatus: 0, familiarityContrast: 0, slowburnSpark: 2 },
  ambitious_icon: { warmthEdge: 0, stabilityAdventure: -1, understatedExpressive: 1, depthStatus: 2, familiarityContrast: 1, slowburnSpark: 0 },
  brilliant_tease: { warmthEdge: 1, stabilityAdventure: 0, understatedExpressive: 1, depthStatus: -2, familiarityContrast: 0, slowburnSpark: -1 },
  beautiful_mystery: { warmthEdge: 0, stabilityAdventure: 0, understatedExpressive: -2, depthStatus: 0, familiarityContrast: 1, slowburnSpark: -2 },
  free_spirit: { warmthEdge: 1, stabilityAdventure: 2, understatedExpressive: 1, depthStatus: -1, familiarityContrast: 1, slowburnSpark: 1 },
  grounded_equal: { warmthEdge: -1, stabilityAdventure: -2, understatedExpressive: -1, depthStatus: -1, familiarityContrast: -1, slowburnSpark: -1 },
};

export type SpecTestAnswers = Record<string, SpecTestOptionKey>;

/** Every question id the quiz requires an answer for - used to validate a submission
 *  before scoring it (see app/api/spec-test/submit/route.ts). */
export function specTestQuestionIds(): string[] {
  return QUESTION_IDS;
}

export function scoreSpecTestAnswers(answers: SpecTestAnswers): DimensionVector {
  const scores = zeroVector();
  for (const questionId of QUESTION_IDS) {
    const choice = answers[questionId];
    const weights = choice ? ANSWER_WEIGHTS[`${questionId}.${choice}`] : undefined;
    if (!weights) continue;
    for (const [dimension, weight] of Object.entries(weights)) {
      scores[dimension as SpecTestDimension] += weight ?? 0;
    }
  }
  return scores;
}

function dotProduct(a: DimensionVector, b: DimensionVector): number {
  return SPEC_TEST_DIMENSIONS.reduce((sum, dimension) => sum + a[dimension] * b[dimension], 0);
}

function magnitude(vector: DimensionVector): number {
  return Math.sqrt(dotProduct(vector, vector));
}

function cosineSimilarity(a: DimensionVector, b: DimensionVector): number {
  const denominator = magnitude(a) * magnitude(b);
  if (denominator === 0) return 0;
  return dotProduct(a, b) / denominator;
}

/** Picks the archetype whose centroid the score vector points closest to. Scale-invariant
 *  (cosine similarity), so raw answer-weight magnitudes never need to match the centroids'. */
export function resolveSpecType(scores: DimensionVector): SpecTypeKey {
  let best: SpecTypeKey = "grounded_equal";
  let bestSimilarity = -Infinity;
  for (const [key, centroid] of Object.entries(SPEC_TYPE_CENTROIDS) as [SpecTypeKey, DimensionVector][]) {
    const similarity = cosineSimilarity(scores, centroid);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      best = key;
    }
  }
  return best;
}

export type SpecTypeReading = {
  key: SpecTypeKey;
  name: string;
  tagline: string;
  intro: string;
  whatItSaysAboutYou: string[];
  datingPattern: string[];
  blindSpot: string[];
  whatWorksForYou: string;
  attractionTruth: string;
};

// Copy reproduced from docs/spec-test-quiz.md's eight written readings.
export const SPEC_TYPE_READINGS: Record<SpecTypeKey, SpecTypeReading> = {
  quiet_fire: {
    key: "quiet_fire",
    name: "The Quiet Fire",
    tagline: "Composed, private, observant and surprisingly intense.",
    intro:
      "You’re attracted to people who don’t have to fight for attention to command it. They may be reserved, observant or slightly difficult to read—but underneath that calm exterior, you sense confidence, intelligence and intensity.",
    whatItSaysAboutYou: [
      "You don’t give everyone access to you, even when you appear friendly. You observe people closely: how they treat others, how they carry themselves and whether their confidence is genuine or performed. Loud attraction can entertain you, but subtle chemistry stays in your mind much longer.",
      "You probably enjoy discovering people gradually. A look that lasts a second too long, a conversation with an unexpected layer or the feeling that someone behaves differently around you can affect you more than obvious flirting.",
      "You want to feel chosen—not merely included among twenty people receiving the same attention.",
    ],
    datingPattern: [
      "You may take time to admit that you like someone. By the time other people notice your interest, you’ve probably already replayed several interactions and noticed details the person doesn’t realise they revealed.",
      "You’re often attracted to people who seem emotionally controlled. Their restraint creates space for your imagination, and uncertainty can make the attraction stronger. Once you feel safe, however, you’re much warmer, more playful and more emotionally invested than your initial behaviour suggests.",
    ],
    blindSpot: [
      "You can occasionally mistake emotional unavailability for mystery. Because you’re attracted to what must be uncovered, someone being inconsistent may initially feel intriguing rather than frustrating.",
      "But mystery and confusion are not the same thing. Your best match has depth without making you beg for clarity.",
    ],
    whatWorksForYou:
      "You need someone calm but intentional—someone who gives you room while making their interest unmistakable. They don’t need to tell the whole world how they feel, but they must make sure you know.",
    attractionTruth: "You don’t fall for the loudest person in the room. You fall for the person who makes the room disappear.",
  },
  soft_landing: {
    key: "soft_landing",
    name: "The Soft Landing",
    tagline: "Affectionate, emotionally available and reassuring.",
    intro:
      "You’re drawn to warmth: the kind of person whose presence makes you unclench without realising you were tense. They are attentive, affectionate and emotionally generous. Around them, you feel accepted rather than assessed.",
    whatItSaysAboutYou: [
      "Despite whatever independent image you present, emotional safety matters deeply to you. You want attraction, but you also want relief—the freedom to be imperfect, playful, tired or vulnerable without feeling that affection will suddenly be withdrawn.",
      "Small acts affect you more than extravagant performances. Remembering what you said, checking that you arrived safely, noticing a change in your mood or bringing you something you like can mean more than an expensive but impersonal gesture.",
      "You probably remember how people made you feel long after forgetting exactly what they said.",
    ],
    datingPattern: [
      "You may initially claim that you’re “just seeing how things go,” but once somebody makes you feel understood, you begin imagining how naturally they could fit into your life.",
      "You give a lot when you care. You notice needs, offer reassurance and often become the person others rely on. Because of this, you’re particularly affected by relationships where your tenderness is enjoyed but not returned.",
      "You don’t necessarily require constant communication. What you require is emotional consistency: you want to know that today’s affection will not become tomorrow’s unexplained distance.",
    ],
    blindSpot: [
      "You can sometimes confuse being needed with being loved. A person’s vulnerability may activate your caring side before they have demonstrated that they can care for you equally.",
      "Be careful of becoming someone’s emotional home while remaining a visitor in theirs.",
    ],
    whatWorksForYou:
      "Your best match is affectionate without being dependent, reassuring without becoming possessive and emotionally open without turning you into their therapist.",
    attractionTruth: "The quickest way to your heart is not impressing you. It is making you feel safe enough to put your guard down.",
  },
  electric_charmer: {
    key: "electric_charmer",
    name: "The Electric Charmer",
    tagline: "Bold, playful, sociable and difficult to ignore.",
    intro:
      "You like presence. Your spec is expressive, confident, playful and socially alive—the kind of person who walks into a room and changes its temperature.",
    whatItSaysAboutYou: [
      "You’re energised by chemistry you can feel immediately. You enjoy people who give you something to respond to: banter, boldness, eye contact, spontaneity and a little unpredictability.",
      "Even if you’re naturally quiet, you may be attracted to people who draw out the livelier side of you. If you’re already outgoing, you want someone capable of matching your energy rather than merely watching it.",
      "You don’t just want to admire someone. You want an experience with them.",
    ],
    datingPattern: [
      "Your strongest connections may begin quickly. There’s usually a memorable first interaction, an unusually easy conversation or a moment when both of you recognise the tension.",
      "When interested, you become more playful. You tease, create inside jokes and test whether the other person can keep up. A person can be conventionally attractive and still lose you if interacting with them feels flat.",
      "You’re likely to value stories, memorable dates and relationships with a sense of movement. Too much routine without emotional or playful energy can make you wonder whether the spark has disappeared.",
    ],
    blindSpot: [
      "You can overestimate compatibility when chemistry is intense. Charismatic people are often skilled at creating exciting moments, but excitement does not automatically indicate consistency, empathy or genuine intention.",
      "Sometimes the person who gives you butterflies is activating your uncertainty, not revealing your soulmate.",
    ],
    whatWorksForYou:
      "You need someone vibrant who can also become steady when it matters. The right person doesn’t extinguish the excitement; they prove that attraction can remain alive without keeping you anxious.",
    attractionTruth: "You fall for energy first—but the person who keeps you must bring substance after the spark.",
  },
  ambitious_icon: {
    key: "ambitious_icon",
    name: "The Ambitious Icon",
    tagline: "Polished, driven, respected and visibly going somewhere.",
    intro:
      "You’re attracted to people who appear purposeful. They’re polished, capable and visibly building something—a career, a business, a reputation or simply a life that reflects high standards.",
    whatItSaysAboutYou: [
      "You respect effort. Appearance catches your eye, but what truly impresses you is the sense that somebody has direction. You want to admire the person you’re dating, and you probably want them to be equally proud of you.",
      "You may be attracted to confidence because you value competence in yourself. Even if you haven’t reached every personal goal, you think about the future and dislike the idea of being tied to somebody who has stopped growing.",
      "For you, attraction and respect are closely connected.",
    ],
    datingPattern: [
      "You notice presentation: clothes, speech, manners, ambition and how someone behaves in important settings. You don’t necessarily need wealth, but you want evidence of discipline and potential.",
      "You probably enjoy deliberate gestures. A properly planned date can impress you more than a vague invitation because planning communicates that your time matters.",
      "Once committed, you may naturally think in terms of partnership: what could we build, experience or accomplish together?",
    ],
    blindSpot: [
      "You can sometimes be dazzled by the appearance of success. Status, confidence and polish can conceal emotional immaturity just as easily as they can signal genuine competence.",
      "You may also dismiss promising people too quickly if they are still becoming who they intend to be. Direction can matter more than current position.",
    ],
    whatWorksForYou:
      "Your ideal person is driven but emotionally present. They have their own life, but they don’t treat affection like another appointment squeezed into their calendar.",
    attractionTruth: "You don’t simply want someone attractive. You want someone whose life makes you think, “Yes, this person makes sense beside me.”",
  },
  brilliant_tease: {
    key: "brilliant_tease",
    name: "The Brilliant Tease",
    tagline: "Intelligent, witty and mentally stimulating.",
    intro:
      "Your attraction often begins in your mind. You’re drawn to intelligence, humour and verbal chemistry—the person who catches your meaning quickly, challenges you playfully and knows exactly when to say something outrageous.",
    whatItSaysAboutYou: [
      "Being understood is seductive to you. You want somebody who notices the layers beneath your words and gives you conversations that don’t feel interchangeable with everyone else’s.",
      "Humour is especially important because it reveals speed, confidence and compatibility simultaneously. When someone understands your jokes—and makes references only you would appreciate—it creates a private little world between you.",
      "You probably develop attraction through conversation more often than you admit. Someone may become significantly better-looking to you once you discover how their mind works.",
    ],
    datingPattern: [
      "When you like somebody, you may flirt by teasing them, debating unnecessary topics or sending oddly specific content. Your affection can hide inside jokes, mock arguments and conversations that continue much longer than either person intended.",
      "You lose interest when communication becomes repetitive. “Have you eaten?” may be sweet, but you need more than daily attendance. You want curiosity, surprise and the feeling that the other person is genuinely engaging with you.",
    ],
    blindSpot: [
      "You can mistake conversational brilliance for emotional intelligence. Someone may know how to stimulate your mind while remaining evasive about their feelings.",
      "You may also use humour to avoid revealing that something actually matters to you. If everything becomes a joke, the other person may never realise when you need sincerity.",
    ],
    whatWorksForYou: "You need someone clever enough to intrigue you and emotionally mature enough to speak plainly when the jokes end.",
    attractionTruth: "Your real foreplay is the conversation that makes you look at the time and realise it is suddenly 2 a.m.",
  },
  beautiful_mystery: {
    key: "beautiful_mystery",
    name: "The Beautiful Mystery",
    tagline: "Stylish, selective, restrained and slightly difficult to read.",
    intro:
      "You’re drawn to people with layers. They are stylish, selective and slightly elusive—not necessarily secretive, but never completely available to everyone.",
    whatItSaysAboutYou: [
      "You have a strong imagination, and anticipation is part of attraction for you. When a person reveals themselves gradually, every discovery feels meaningful. You enjoy wondering what they’re thinking and noticing the subtle differences between their public personality and the version they show you privately.",
      "Aesthetics probably matter to you—not always conventional beauty, but coherence. You notice when somebody has a distinctive style, taste or way of carrying themselves.",
      "You’re attracted to people who seem to possess an inner world.",
    ],
    datingPattern: [
      "You may become interested before much has actually happened. A look, a particular photograph, an unusual comment or a moment of unexpected vulnerability can occupy your thoughts for longer than it reasonably should.",
      "You are often drawn to selectiveness because being chosen by someone discerning feels significant. Obvious attention may flatter you, but carefully rationed attention can fascinate you.",
      "Once someone becomes completely predictable, you may worry that the magic is fading. What you really need, however, is continued discovery—not instability.",
    ],
    blindSpot: [
      "Your imagination can occasionally build a more interesting person than reality provides. When information is missing, you may fill the gaps with potential.",
      "A person being difficult to access does not automatically make them deep. Sometimes a locked door is merely a locked door.",
    ],
    whatWorksForYou:
      "Your best relationship contains privacy, individuality and continual discovery, alongside honest communication. You need someone who keeps some mystery without keeping you insecure.",
    attractionTruth: "You’re rarely captivated by what everyone can see. You want to discover the version of someone that not everyone gets.",
  },
  free_spirit: {
    key: "free_spirit",
    name: "The Free Spirit",
    tagline: "Expressive, adventurous and resistant to predictability.",
    intro:
      "You’re attracted to people who feel alive. They’re expressive, adventurous and comfortable doing things differently. Being around them makes life appear larger and less predictable.",
    whatItSaysAboutYou: [
      "Freedom matters to you, even if you also want closeness. You dislike relationships that immediately begin to feel like obligations, routines or a list of rules. You want to choose someone repeatedly, not feel trapped into performing romance.",
      "You may be attracted to people who embody qualities you want more of in yourself: courage, spontaneity, creativity or the ability to ignore unnecessary judgment.",
      "Your ideal relationship feels like both a connection and an adventure.",
    ],
    datingPattern: [
      "You’re probably drawn to unusual stories, distinctive personalities and people who introduce you to something new. Dates become more exciting when they contain surprise, movement or a little harmless chaos.",
      "When you like someone, you want to experience life beside them. You would often prefer doing something memorable to sitting through another formal interview disguised as a date.",
      "You need space to remain an individual, and you are likely to give your partner similar freedom—provided trust has been established.",
    ],
    blindSpot: [
      "You can mistake inconsistency for spontaneity. Someone constantly changing plans, avoiding responsibility or appearing only when it suits them is not necessarily free-spirited; they may simply be unreliable.",
      "You may also retreat when a relationship becomes serious because stability initially feels like a loss of excitement.",
    ],
    whatWorksForYou: "You need someone open-minded and adventurous who still keeps their word. The right relationship expands your world without destabilising it.",
    attractionTruth: "You want someone who makes you forget the plan—not someone who makes you regret having no plan.",
  },
  grounded_equal: {
    key: "grounded_equal",
    name: "The Grounded Equal",
    tagline: "Dependable, values-driven and naturally compatible with their life.",
    intro:
      "You’re attracted to people who feel real. They’re dependable, self-aware and comfortable being themselves. There is less performance and more genuine compatibility.",
    whatItSaysAboutYou: [
      "You value peace more than unnecessary drama, although that doesn’t mean you want a boring relationship. You simply prefer attraction that can survive ordinary life—not just carefully selected photographs and exciting first dates.",
      "Shared values matter to you. You pay attention to how someone handles responsibility, communicates during disagreement and treats people they have nothing to gain from.",
      "You want a partner, not a project and not an audience.",
    ],
    datingPattern: [
      "Your strongest attraction may grow gradually. Someone becomes more appealing as you discover their reliability, humour, principles and the ease with which your lives fit together.",
      "You’re likely to show love practically: making time, solving problems, checking in and remembering what matters. Grand romantic gestures are welcome, but consistent behaviour earns your trust.",
      "You may be cautious initially because you don’t enjoy investing in people whose intentions constantly change. Once committed, however, you take the relationship seriously.",
    ],
    blindSpot: [
      "Because you appreciate stability, you may remain in connections that are comfortable but no longer emotionally fulfilling. Peace and passivity can look similar from the outside.",
      "You might also underestimate the importance of novelty until routine begins to feel like emotional distance.",
    ],
    whatWorksForYou:
      "You need someone dependable who still brings curiosity, affection and intentional romance into everyday life. Compatibility should be the foundation—not the excuse to stop trying.",
    attractionTruth: "You’re not looking for someone who turns your entire life upside down. You want someone who makes your existing life feel better to live.",
  },
};

export type SpecTestLead = {
  id: string;
  email: string;
  specType: SpecTypeKey;
  consentMarketing: boolean;
  createdAt: Date;
  /** Set once this lead's email matched a new signup - see linkSpecTestResultIfConsented. */
  joinedUsername: string | null;
};

/** Admin-facing view of everyone who gave an email to receive their result - see
 *  app/(admin)/admin/spec-test/page.tsx. Rows without an email were never a lead. */
export async function getSpecTestLeads(filters: { cursor?: string; take?: number } = {}): Promise<{
  items: SpecTestLead[];
  nextCursor: string | null;
}> {
  const take = Math.min(filters.take ?? 50, 200);

  const rows = await prisma.specTestResult.findMany({
    where: { email: { not: null } },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      email: true,
      specType: true,
      consentMarketing: true,
      createdAt: true,
      profile: { select: { username: true } },
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    items: page.map((row) => ({
      id: row.id,
      email: row.email!,
      specType: row.specType as SpecTypeKey,
      consentMarketing: row.consentMarketing,
      createdAt: row.createdAt,
      joinedUsername: row.profile?.username ?? null,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/**
 * Called right after a new account is created (see app/api/signup/route.ts and
 * ensureProfileForAuthUser in lib/auth.ts) so a consenting Spec Test result finds its
 * way to the account its taker went on to create. Deliberately does NOT feed
 * recommendations/ranking - this codebase treats those as behavior-only by design (see
 * lib/ranking/people-scoring.ts), so this is bookkeeping/attribution only for now, not a
 * personalization signal. Matches only the newest unlinked, consenting result for the
 * email, and never throws - a failure here must never block account creation.
 */
export async function linkSpecTestResultIfConsented(email: string, profileId: string): Promise<void> {
  try {
    const pending = await prisma.specTestResult.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, consentMarketing: true, profileId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!pending) return;

    await prisma.specTestResult.update({ where: { id: pending.id }, data: { profileId } });
  } catch (error) {
    console.error("[spec-test] failed to link result to new profile", error);
  }
}
