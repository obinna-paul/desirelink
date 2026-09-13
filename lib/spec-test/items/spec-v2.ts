// Client-safe. Prompts and option labels only - no motive/lens weights. The scoring wizard
// (a client component) renders this directly; the loadings that turn an optionId into a
// motive/lens/attachment contribution live in lib/spec-test/scoring/loadings.ts, which is
// server-only and never ships to the browser. See docs/spec-test-research.md §5 for the
// product-design source of the 20 core items, and docs/spec-test-v2-implementation-plan.md
// open decision D-1 for why four attachment-scenario items were added on top of those 20.
//
// Bracketed motive codes appear only in code comments here (traceability back to the report),
// never in prompt/label text - the report is explicit that respondents must not see them.

import { INSTRUMENT_VERSION, type SectionKey } from "@/lib/spec-test/taxonomy";

export type SpecItemOptionV2 = {
  id: string;
  label: string;
};

export type SpecItemV2 = {
  id: string;
  section: SectionKey;
  prompt: string;
  options: [SpecItemOptionV2, SpecItemOptionV2, SpecItemOptionV2, SpecItemOptionV2];
};

/**
 * The v2.0 item bank: 20 core items from docs/spec-test-research.md §5 (Spark 1-8, Pattern
 * 9-16, Partnership 17-20) plus 4 original attachment-response scenarios (Pattern) covering
 * the four situations the report's §6.3 attachment lens calls for - reassurance after a
 * delayed reply, response to rapid closeness, conflict pursuit/withdrawal, and comfort
 * asking for support - none of which the 20 core items measure.
 */
export const SPEC_TEST_ITEMS_V2: SpecItemV2[] = [
  // --- Spark (report §5 items 1-8) ---------------------------------------------------
  {
    id: "crowded-event",
    section: "spark",
    prompt: "At a crowded event, who makes you look twice?",
    options: [
      { id: "crowded-event-a", label: "The quiet {person} clocking everything from the edge of the room." }, // [I-depth]
      { id: "crowded-event-b", label: "The {person} turning strangers into friends within ten minutes." }, // [V]
      { id: "crowded-event-c", label: "The polished {person} people instinctively ask for an opinion." }, // [A]
      { id: "crowded-event-d", label: "The beautifully put-together {person} who leaves before anyone fully figures {them} out." }, // [I-aesthetic]
    ],
  },
  {
    id: "first-date-danger",
    section: "spark",
    prompt: "Which first date sounds most dangerous to your single era?",
    options: [
      { id: "first-date-danger-a", label: "Dinner where you somehow tell each other the truth." }, // [W]
      { id: "first-date-danger-b", label: "A bookstore, drinks, and a debate that becomes flirting." }, // [C]
      { id: "first-date-danger-c", label: "A spontaneous plan neither of you has tried before." }, // [N]
      { id: "first-date-danger-d", label: "A simple place, excellent conversation, and no performance." }, // [R]
    ],
  },
  {
    id: "message-replay",
    section: "spark",
    prompt: "Which message would replay in your head?",
    options: [
      { id: "message-replay-a", label: "“I don’t say this often, but I feel unusually calm with you.”" }, // [I-depth]
      { id: "message-replay-b", label: "“I remembered what you said yesterday. How did it go?”" }, // [W]
      { id: "message-replay-c", label: "“You are annoyingly interesting. Continue.”" }, // [C]
      { id: "message-replay-d", label: "A voice note that turns an ordinary Tuesday into an event." }, // [V]
    ],
  },
  {
    id: "profile-investigate",
    section: "spark",
    prompt: "Whose profile are you most likely to investigate?",
    options: [
      { id: "profile-investigate-a", label: "Clear goals, excellent work, very little noise." }, // [A]
      { id: "profile-investigate-b", label: "Immaculate taste and captions that reveal almost nothing." }, // [I-aesthetic]
      { id: "profile-investigate-c", label: "Different city every month; somehow every photo has a story." }, // [N]
      { id: "profile-investigate-d", label: "Friends, family, hobbies and a life that clearly suits {them}." }, // [R]
    ],
  },
  {
    id: "compliment-deepest",
    section: "spark",
    prompt: "Which compliment would land deepest?",
    options: [
      { id: "compliment-deepest-a", label: "“You change the energy of a room.”" }, // [V]
      { id: "compliment-deepest-b", label: "“I respect how you move through life.”" }, // [A]
      { id: "compliment-deepest-c", label: "“Talking to you rearranges how I think.”" }, // [C]
      { id: "compliment-deepest-d", label: "“I feel safe being fully myself with you.”" }, // [W]
    ],
  },
  {
    id: "conversation-pause",
    section: "spark",
    prompt: "A pause falls in the conversation. Which version feels attractive?",
    options: [
      { id: "conversation-pause-a", label: "The silence feels charged, not awkward." }, // [I-depth]
      { id: "conversation-pause-b", label: "The {person} holds your gaze as if already knowing something you do not." }, // [I-aesthetic]
      { id: "conversation-pause-c", label: "The {person} is comfortable enough not to fill every gap." }, // [R]
      { id: "conversation-pause-d", label: "The {person} suddenly suggests going somewhere completely different." }, // [N]
    ],
  },
  {
    id: "hosting-party",
    section: "spark",
    prompt: "The {person} you’re seeing is hosting. What wins you over?",
    options: [
      { id: "hosting-party-a", label: "The {person} notices exactly who needs to be included." }, // [W]
      { id: "hosting-party-b", label: "Everybody is laughing, but you still feel singled out." }, // [V]
      { id: "hosting-party-c", label: "Everything runs beautifully without {them} looking stressed." }, // [A]
      { id: "hosting-party-d", label: "The conversation at {their} table is the best one in the room." }, // [C]
    ],
  },
  {
    id: "slow-reveal",
    section: "spark",
    prompt: "Which slow reveal keeps you interested?",
    options: [
      { id: "slow-reveal-a", label: "The {person} becomes warmer in private than anyone would expect." }, // [I-depth]
      { id: "slow-reveal-b", label: "Every meeting reveals another layer of taste and history." }, // [I-aesthetic]
      { id: "slow-reveal-c", label: "{Their} life keeps opening into experiences you never considered." }, // [N]
      { id: "slow-reveal-d", label: "{Their} consistency becomes more attractive the longer you watch." }, // [R]
    ],
  },

  // --- Pattern (report §5 items 9-16) ------------------------------------------------
  {
    id: "disagreement-response",
    section: "pattern",
    prompt: "A disagreement begins. Which response increases attraction?",
    options: [
      { id: "disagreement-response-a", label: "“I care about us. Let me understand what hurt.”" }, // [W]
      { id: "disagreement-response-b", label: "The {person} stays calm, decisive and willing to own {their} part." }, // [A]
      { id: "disagreement-response-c", label: "{They} can challenge your argument without attacking you." }, // [C]
      { id: "disagreement-response-d", label: "The {person} focuses on solving the issue fairly, not winning." }, // [R]
    ],
  },
  {
    id: "plans-cancelled",
    section: "pattern",
    prompt: "Plans are cancelled at the last minute. What could genuinely rescue the mood?",
    options: [
      { id: "plans-cancelled-a", label: "The {person} creates a better night on the spot." }, // [V]
      { id: "plans-cancelled-b", label: "The {person} sends one intriguing suggestion and lets anticipation build." }, // [I-aesthetic]
      { id: "plans-cancelled-c", label: "“Pack light. Trust me.”" }, // [N]
      { id: "plans-cancelled-d", label: "An unexpectedly honest private conversation." }, // [I-depth]
    ],
  },
  {
    id: "feel-chosen",
    section: "pattern",
    prompt: "What most makes you feel chosen?",
    options: [
      { id: "feel-chosen-a", label: "Consistent reassurance and affection." }, // [W]
      { id: "feel-chosen-b", label: "Being deliberately included in the {personPoss} plans for the future." }, // [A]
      { id: "feel-chosen-c", label: "Equal effort without having to request it." }, // [R]
      { id: "feel-chosen-d", label: "Access to a side of {them} almost nobody sees." }, // [I-aesthetic]
    ],
  },
  {
    id: "routine-desire",
    section: "pattern",
    prompt: "The relationship is becoming routine. What brings desire back fastest?",
    options: [
      { id: "routine-desire-a", label: "A shameless night out and obvious flirting." }, // [V]
      { id: "routine-desire-b", label: "A conversation neither of you has ever had before." }, // [C]
      { id: "routine-desire-c", label: "Learning or doing something new together." }, // [N]
      { id: "routine-desire-d", label: "Time alone that restores longing and depth." }, // [I-depth]
    ],
  },
  {
    id: "friend-introduction",
    section: "pattern",
    prompt: "A friend says, “I know exactly who to introduce you to.” What description wins?",
    options: [
      { id: "friend-introduction-a", label: "“Mature, kind and genuinely ready.”" }, // [R]
      { id: "friend-introduction-b", label: "“Warm—the sort of {person} who makes people feel at home.”" }, // [W]
      { id: "friend-introduction-c", label: "“Focused. Going somewhere.”" }, // [A]
      { id: "friend-introduction-d", label: "“Ridiculously smart, but never boring about it.”" }, // [C]
    ],
  },
  {
    id: "strongest-entrance",
    section: "pattern",
    prompt: "Which entrance has the strongest effect on you?",
    options: [
      { id: "strongest-entrance-a", label: "Understated, impeccable, impossible not to notice." }, // [I-aesthetic]
      { id: "strongest-entrance-b", label: "Almost silent, but the eye contact is not." }, // [I-depth]
      { id: "strongest-entrance-c", label: "The {person} arrives laughing and the room lifts." }, // [V]
      { id: "strongest-entrance-d", label: "The {person} looks as though a story just ended." }, // [N]
    ],
  },
  {
    id: "intimate-vulnerability",
    section: "pattern",
    prompt: "Which kind of vulnerability feels most intimate?",
    options: [
      { id: "intimate-vulnerability-a", label: "The {person} asks directly for comfort instead of pretending." }, // [W]
      { id: "intimate-vulnerability-b", label: "The {person} explains the thought beneath the feeling." }, // [C]
      { id: "intimate-vulnerability-c", label: "The {person} admits a mistake and shows what will change." }, // [R]
      { id: "intimate-vulnerability-d", label: "The {person} trusts you with something usually kept guarded." }, // [I-depth]
    ],
  },
  {
    id: "attractive-life",
    section: "pattern",
    prompt: "Which life feels most attractive to join?",
    options: [
      { id: "attractive-life-a", label: "Purposeful, beautifully structured, steadily rising." }, // [A]
      { id: "attractive-life-b", label: "Social, playful and full of people." }, // [V]
      { id: "attractive-life-c", label: "Curated, private and rich in taste." }, // [I-aesthetic]
      { id: "attractive-life-d", label: "Flexible, surprising and open to reinvention." }, // [N]
    ],
  },

  // --- Attachment-response scenarios (original items - see D-1) ----------------------
  {
    id: "delayed-reply",
    section: "pattern",
    prompt: "Your last message got left on read for a day. What’s actually happening in your head?",
    options: [
      { id: "delayed-reply-a", label: "I start rereading the conversation for a clue I might have missed." }, // anxiety
      { id: "delayed-reply-b", label: "I assume the {person} is busy and don’t think about it much." }, // steady
      { id: "delayed-reply-c", label: "I feel my interest cool a little, just in case." }, // avoidance
      { id: "delayed-reply-d", label: "I send something breezy to test the temperature without asking directly." }, // push-pull
    ],
  },
  {
    id: "fast-closeness",
    section: "pattern",
    prompt: "Things move fast and someone starts wanting a lot of your time early on. What’s your instinct?",
    options: [
      { id: "fast-closeness-a", label: "I lean in—it feels like a sign this is real." }, // anxiety
      { id: "fast-closeness-b", label: "I match {their} pace happily, no hesitation." }, // steady
      { id: "fast-closeness-c", label: "Part of me wants to slow it down and protect my space." }, // avoidance
      { id: "fast-closeness-d", label: "I enjoy it but quietly wonder if it will last." }, // push-pull
    ],
  },
  {
    id: "conflict-response",
    section: "pattern",
    prompt: "You’re upset with someone you’re seeing. What do you actually do?",
    options: [
      { id: "conflict-response-a", label: "I bring it up right away, even if it’s uncomfortable." }, // steady
      { id: "conflict-response-b", label: "I keep pushing until we’ve really resolved it, even if the {person} wants to drop it." }, // anxiety
      { id: "conflict-response-c", label: "I go quiet and need space before I can talk about it." }, // avoidance
      { id: "conflict-response-d", label: "I hint at it and hope the {person} notices." }, // push-pull
    ],
  },
  {
    id: "need-comfort",
    section: "pattern",
    prompt: "You’re having a rough week. What’s true for you?",
    options: [
      { id: "need-comfort-a", label: "I ask directly for comfort—“can you just be here for a minute.”" }, // steady
      { id: "need-comfort-b", label: "I want {them} to notice without me having to ask." }, // anxiety
      { id: "need-comfort-c", label: "I’d rather handle it myself and fill {them} in after." }, // avoidance
      { id: "need-comfort-d", label: "I want comfort but downplay how much I need it." }, // push-pull
    ],
  },

  // --- Partnership (report §5 items 17-20) -------------------------------------------
  {
    id: "forgivable-flaw",
    section: "partnership",
    prompt: "Which flaw are you most likely to forgive for too long?",
    options: [
      { id: "forgivable-flaw-a", label: "Emotional distance, because rare closeness feels profound." }, // [I-depth]
      { id: "forgivable-flaw-b", label: "Inconsistency, because the chemistry is outrageous." }, // [V]
      { id: "forgivable-flaw-c", label: "Deflection, because the conversation is addictive." }, // [C]
      { id: "forgivable-flaw-d", label: "Opacity, because the {person} fascinates you." }, // [I-aesthetic]
    ],
  },
  {
    id: "lasting-partnership",
    section: "partnership",
    prompt: "When you imagine a lasting partnership, what matters most?",
    options: [
      { id: "lasting-partnership-a", label: "We remain emotionally kind to each other." }, // [W]
      { id: "lasting-partnership-b", label: "We build a life we both respect." }, // [A]
      { id: "lasting-partnership-c", label: "We keep growing without owning each other." }, // [N]
      { id: "lasting-partnership-d", label: "We carry the ordinary weight fairly." }, // [R]
    ],
  },
  {
    id: "chemistry-definition",
    section: "partnership",
    prompt: "What is your most immediate definition of chemistry?",
    options: [
      { id: "chemistry-definition-a", label: "Tension in everything neither person is saying." }, // [I-depth]
      { id: "chemistry-definition-b", label: "Effortless energy and mutual boldness." }, // [V]
      { id: "chemistry-definition-c", label: "A conversation that becomes its own world." }, // [C]
      { id: "chemistry-definition-d", label: "Beauty, restraint and wanting a closer look." }, // [I-aesthetic]
    ],
  },
  {
    id: "repeated-sunday",
    section: "partnership",
    prompt: "Choose the Sunday you would want repeatedly.",
    options: [
      { id: "repeated-sunday-a", label: "Affection, food, rest and being cared for." }, // [W]
      { id: "repeated-sunday-b", label: "Planning the week and building something together." }, // [A]
      { id: "repeated-sunday-c", label: "Waking up and deciding the day as you go." }, // [N]
      { id: "repeated-sunday-d", label: "An easy rhythm in which both people naturally contribute." }, // [R]
    ],
  },
];

export function specTestItemIdsV2(): string[] {
  return SPEC_TEST_ITEMS_V2.map((item) => item.id);
}

export function specTestItemV2(itemId: string): SpecItemV2 | undefined {
  return SPEC_TEST_ITEMS_V2.find((item) => item.id === itemId);
}

/** Sanity check that this file's version tag matches the taxonomy - fails fast in tests if
 *  the two are ever bumped independently. */
export const ITEM_BANK_VERSION = INSTRUMENT_VERSION;
