// Client-safe. Prompts and option labels only - no motive/lens weights. The scoring wizard
// (a client component) renders this directly; the loadings that turn an optionId into a
// motive/lens/attachment contribution live in lib/spec-test/scoring/loadings.ts, which is
// server-only and never ships to the browser. See docs/spec-test-research.md §5 for the
// product-design source of the 20 core items, and docs/spec-test-v2-implementation-plan.md
// open decision D-1 for why four attachment-scenario items were added on top of those 20.
//
// Bracketed motive codes appear only in code comments here (traceability back to the report),
// never in prompt/label text - the report is explicit that respondents must not see them.
//
// Wording rewritten (following direct user feedback: the original prompts read dense and
// clinical enough to reread twice, and put people to sleep rather than making them smile).
// Every id below - item and option - is byte-identical to before, and every option still
// reads as clear, honest evidence of the exact same motive/attachment code in the comment
// beside it (verified against lib/spec-test/scoring/loadings.ts's optionId mapping, which
// this file never touches). Only the words changed: shorter, funnier, more "us at a bar"
// than "us reading a psychometric prototype," with the flirtier edge appropriate to an adult
// dating product - never explicit, just openly about chemistry and attraction instead of
// dancing around it.

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
    prompt: "You walk into a packed party. Who makes you do a double take?",
    options: [
      { id: "crowded-event-a", label: "The quiet {person} in the corner, clearly clocking everyone's business." }, // [I-depth]
      { id: "crowded-event-b", label: "The {person} who's already got the whole room laughing." }, // [V]
      { id: "crowded-event-c", label: "The {person} everyone treats like the one actually running the place." }, // [A]
      { id: "crowded-event-d", label: "The devastatingly put-together {person} who leaves before anyone figures {them} out." }, // [I-aesthetic]
    ],
  },
  {
    id: "first-date-danger",
    section: "spark",
    prompt: "Which first date is most likely to end your single era?",
    options: [
      { id: "first-date-danger-a", label: "Dinner that turns into an accidental heart to heart." }, // [W]
      { id: "first-date-danger-b", label: "A bookstore, a drink, and an argument that turns into flirting." }, // [C]
      { id: "first-date-danger-c", label: "A last minute plan neither of you has ever tried before." }, // [N]
      { id: "first-date-danger-d", label: "Nothing fancy, just good conversation and zero performance." }, // [R]
    ],
  },
  {
    id: "message-replay",
    section: "spark",
    prompt: "Which text would you screenshot and reread later?",
    options: [
      { id: "message-replay-a", label: "“I don’t say this to just anyone, but I feel weirdly calm around you.”" }, // [I-depth]
      { id: "message-replay-b", label: "“Hey, how’d that thing you mentioned yesterday go?”" }, // [W]
      { id: "message-replay-c", label: "“You’re annoyingly interesting. Please continue.”" }, // [C]
      { id: "message-replay-d", label: "A voice note so unhinged it turns a boring Tuesday into an event." }, // [V]
    ],
  },
  {
    id: "profile-investigate",
    section: "spark",
    prompt: "Whose profile are you most likely to fully investigate, captions and all?",
    options: [
      { id: "profile-investigate-a", label: "Clear goals, great job, zero chaos in the bio." }, // [A]
      { id: "profile-investigate-b", label: "Immaculate taste, captions that give away nothing." }, // [I-aesthetic]
      { id: "profile-investigate-c", label: "New city every month, and every single photo has a story." }, // [N]
      { id: "profile-investigate-d", label: "Friends, family, hobbies, a whole life that clearly fits {them}." }, // [R]
    ],
  },
  {
    id: "compliment-deepest",
    section: "spark",
    prompt: "Which compliment would actually get you?",
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
    prompt: "The conversation goes quiet for a second. Which silence feels hot, not awkward?",
    options: [
      { id: "conversation-pause-a", label: "The silence feels loaded, like something's about to happen." }, // [I-depth]
      { id: "conversation-pause-b", label: "The {person} just holds your eyes, like there's already a secret between you." }, // [I-aesthetic]
      { id: "conversation-pause-c", label: "The {person} is comfortable enough to just let the silence sit." }, // [R]
      { id: "conversation-pause-d", label: "The {person} suddenly says, “let's get out of here,” somewhere completely different." }, // [N]
    ],
  },
  {
    id: "hosting-party",
    section: "spark",
    prompt: "The {person} you're seeing is throwing a party. What actually wins you over?",
    options: [
      { id: "hosting-party-a", label: "The {person} makes sure nobody's standing alone in the corner." }, // [W]
      { id: "hosting-party-b", label: "Everyone's cracking up, but you're still the one getting all of {their} attention." }, // [V]
      { id: "hosting-party-c", label: "The whole night runs perfectly, without a single stressed out moment from the {person} throwing it." }, // [A]
      { id: "hosting-party-d", label: "Somehow the best conversation of the night is happening at {their} table." }, // [C]
    ],
  },
  {
    id: "slow-reveal",
    section: "spark",
    prompt: "Which slow reveal keeps you hooked?",
    options: [
      { id: "slow-reveal-a", label: "The {person} is way warmer one on one than anyone in public would guess." }, // [I-depth]
      { id: "slow-reveal-b", label: "Every time you meet, you notice one more detail about {their} taste." }, // [I-aesthetic]
      { id: "slow-reveal-c", label: "{Their} life keeps opening into things you never would have guessed." }, // [N]
      { id: "slow-reveal-d", label: "The longer you know {them}, the more {their} consistency turns you on." }, // [R]
    ],
  },

  // --- Pattern (report §5 items 9-16) ------------------------------------------------
  {
    id: "disagreement-response",
    section: "pattern",
    prompt: "You two disagree about something. Which response actually turns you on more?",
    options: [
      { id: "disagreement-response-a", label: "“I care about us. Let me understand what hurt.”" }, // [W]
      { id: "disagreement-response-b", label: "The {person} stays calm, takes the lead, and owns {their} part of it." }, // [A]
      { id: "disagreement-response-c", label: "{They} can challenge your argument without attacking you." }, // [C]
      { id: "disagreement-response-d", label: "The {person} just wants to fix it fairly, not win the argument." }, // [R]
    ],
  },
  {
    id: "plans-cancelled",
    section: "pattern",
    prompt: "Your plans just fell through, last minute. What actually saves the night?",
    options: [
      { id: "plans-cancelled-a", label: "The {person} improvises something even better on the spot." }, // [V]
      { id: "plans-cancelled-b", label: "The {person} sends one mysterious text and lets you sit with the anticipation." }, // [I-aesthetic]
      { id: "plans-cancelled-c", label: "“Pack light. Trust me.”" }, // [N]
      { id: "plans-cancelled-d", label: "An unexpectedly deep, just the two of you conversation instead." }, // [I-depth]
    ],
  },
  {
    id: "feel-chosen",
    section: "pattern",
    prompt: "What actually makes you feel chosen, not just convenient?",
    options: [
      { id: "feel-chosen-a", label: "Consistent affection, no guessing required." }, // [W]
      { id: "feel-chosen-b", label: "Being written into {personPoss} actual future plans, on purpose." }, // [A]
      { id: "feel-chosen-c", label: "Matching effort, without you having to ask for it." }, // [R]
      { id: "feel-chosen-d", label: "Getting a side of {them} almost nobody else gets to see." }, // [I-aesthetic]
    ],
  },
  {
    id: "routine-desire",
    section: "pattern",
    prompt: "Things are getting a little routine. What brings the spark back fastest?",
    options: [
      { id: "routine-desire-a", label: "A shameless night out and zero subtlety about the flirting." }, // [V]
      { id: "routine-desire-b", label: "A conversation you've genuinely never had before." }, // [C]
      { id: "routine-desire-c", label: "Trying something neither of you has ever done, together." }, // [N]
      { id: "routine-desire-d", label: "Time alone that brings the longing right back." }, // [I-depth]
    ],
  },
  {
    id: "friend-introduction",
    section: "pattern",
    prompt: "Your friend says, “I know exactly who you need to meet.” Which description gets you excited?",
    options: [
      { id: "friend-introduction-a", label: "“Mature, kind and genuinely ready.”" }, // [R]
      { id: "friend-introduction-b", label: "“So warm. The kind of {person} who makes everyone feel at home.”" }, // [W]
      { id: "friend-introduction-c", label: "“Focused. Going somewhere.”" }, // [A]
      { id: "friend-introduction-d", label: "“Ridiculously smart, but never boring about it.”" }, // [C]
    ],
  },
  {
    id: "strongest-entrance",
    section: "pattern",
    prompt: "Which entrance actually stops you mid sentence?",
    options: [
      { id: "strongest-entrance-a", label: "Understated, flawless, somehow impossible to ignore." }, // [I-aesthetic]
      { id: "strongest-entrance-b", label: "Almost silent, but the eye contact is not." }, // [I-depth]
      { id: "strongest-entrance-c", label: "The {person} walks in laughing and suddenly the whole room's more fun." }, // [V]
      { id: "strongest-entrance-d", label: "The {person} looks like {they} just walked out of a story you want to hear." }, // [N]
    ],
  },
  {
    id: "intimate-vulnerability",
    section: "pattern",
    prompt: "Which kind of vulnerable moment actually feels the most intimate?",
    options: [
      { id: "intimate-vulnerability-a", label: "The {person} just asks for comfort instead of pretending everything's fine." }, // [W]
      { id: "intimate-vulnerability-b", label: "The {person} actually explains the thought underneath the feeling." }, // [C]
      { id: "intimate-vulnerability-c", label: "The {person} owns a mistake and actually shows you what changes next." }, // [R]
      { id: "intimate-vulnerability-d", label: "The {person} hands you something usually kept locked up." }, // [I-depth]
    ],
  },
  {
    id: "attractive-life",
    section: "pattern",
    prompt: "Which life would you actually want to be part of?",
    options: [
      { id: "attractive-life-a", label: "Purposeful, beautifully structured, steadily rising." }, // [A]
      { id: "attractive-life-b", label: "Social, playful, always full of people and plans." }, // [V]
      { id: "attractive-life-c", label: "Curated, private, dripping in good taste." }, // [I-aesthetic]
      { id: "attractive-life-d", label: "Flexible, unpredictable, always up for reinvention." }, // [N]
    ],
  },

  // --- Attachment-response scenarios (original items - see D-1) ----------------------
  {
    id: "delayed-reply",
    section: "pattern",
    prompt: "Your text got left on read for a whole day. What's actually going on in your head?",
    options: [
      { id: "delayed-reply-a", label: "I reread the whole conversation for a clue I somehow missed." }, // anxiety
      { id: "delayed-reply-b", label: "I figure the {person} is busy and honestly don't think much of it." }, // steady
      { id: "delayed-reply-c", label: "My interest quietly cools off, just in case." }, // avoidance
      { id: "delayed-reply-d", label: "I send something casual to test the waters without actually asking." }, // push-pull
    ],
  },
  {
    id: "fast-closeness",
    section: "pattern",
    prompt: "Things move fast and someone wants a lot of your time, early. What's your gut reaction?",
    options: [
      { id: "fast-closeness-a", label: "I lean all the way in. It feels like proof this is real." }, // anxiety
      { id: "fast-closeness-b", label: "I match {their} pace happily, no hesitation." }, // steady
      { id: "fast-closeness-c", label: "Part of me wants to slow it down and protect my space." }, // avoidance
      { id: "fast-closeness-d", label: "I enjoy it but quietly wonder if it will last." }, // push-pull
    ],
  },
  {
    id: "conflict-response",
    section: "pattern",
    prompt: "You're annoyed with someone you're seeing. What do you actually do about it?",
    options: [
      { id: "conflict-response-a", label: "I bring it up right away, even if it's uncomfortable." }, // steady
      { id: "conflict-response-b", label: "I keep pushing until we've really resolved it, even if the {person} wants to drop it." }, // anxiety
      { id: "conflict-response-c", label: "I go quiet and need space before I can talk about it." }, // avoidance
      { id: "conflict-response-d", label: "I hint at it and hope the {person} notices." }, // push-pull
    ],
  },
  {
    id: "need-comfort",
    section: "pattern",
    prompt: "You're having a rough week. Which one's actually true for you?",
    options: [
      { id: "need-comfort-a", label: "I just ask directly for comfort, something like “can you just be here for a minute.”" }, // steady
      { id: "need-comfort-b", label: "I want {them} to notice without me having to ask." }, // anxiety
      { id: "need-comfort-c", label: "I'd rather handle it myself and fill {them} in after." }, // avoidance
      { id: "need-comfort-d", label: "I want comfort but downplay how much I actually need it." }, // push-pull
    ],
  },

  // --- Partnership (report §5 items 17-20) -------------------------------------------
  {
    id: "forgivable-flaw",
    section: "partnership",
    prompt: "Which flaw would you 100% forgive for way longer than you should?",
    options: [
      { id: "forgivable-flaw-a", label: "Emotional distance, because the rare moments of closeness hit so much harder." }, // [I-depth]
      { id: "forgivable-flaw-b", label: "Inconsistency, because the chemistry is outrageous." }, // [V]
      { id: "forgivable-flaw-c", label: "Constantly deflecting, because the conversation itself is just too addictive." }, // [C]
      { id: "forgivable-flaw-d", label: "Being impossible to read, because the {person} fascinates you anyway." }, // [I-aesthetic]
    ],
  },
  {
    id: "lasting-partnership",
    section: "partnership",
    prompt: "Picture the relationship that actually lasts. What matters most?",
    options: [
      { id: "lasting-partnership-a", label: "We stay emotionally kind to each other." }, // [W]
      { id: "lasting-partnership-b", label: "We build a life we both actually respect." }, // [A]
      { id: "lasting-partnership-c", label: "We keep growing without trying to own each other." }, // [N]
      { id: "lasting-partnership-d", label: "We split the boring, everyday stuff fairly." }, // [R]
    ],
  },
  {
    id: "chemistry-definition",
    section: "partnership",
    prompt: "If someone asked you to define chemistry in one line, what would it be?",
    options: [
      { id: "chemistry-definition-a", label: "Tension in everything neither person is saying." }, // [I-depth]
      { id: "chemistry-definition-b", label: "Effortless energy, you're both just a little bit bold around each other." }, // [V]
      { id: "chemistry-definition-c", label: "A conversation that becomes its own world." }, // [C]
      { id: "chemistry-definition-d", label: "Beauty, restraint, and wanting just one closer look." }, // [I-aesthetic]
    ],
  },
  {
    id: "repeated-sunday",
    section: "partnership",
    prompt: "Pick the Sunday you'd happily repeat on a loop forever.",
    options: [
      { id: "repeated-sunday-a", label: "Cuddles, good food, rest, and being properly taken care of." }, // [W]
      { id: "repeated-sunday-b", label: "Planning the week and building something together." }, // [A]
      { id: "repeated-sunday-c", label: "Waking up and deciding the day as you go." }, // [N]
      { id: "repeated-sunday-d", label: "An easy rhythm where both people naturally pull their weight." }, // [R]
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
