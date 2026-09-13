import "server-only";

// server-only. Per-archetype narrative content for the eight Specs.
//
// Rewritten (post-launch, following direct user feedback: the original prose - transcribed
// close to verbatim from docs/spec-test-research.md §4's "Provisional narrative library" -
// read like a research abstract, not a fun personality quiz. "Your attraction system relaxes
// when care is unmistakable" is accurate; it's also not something anyone screenshots. This
// pass keeps every claim the report actually supports for each archetype (the same
// centroids/motive story - see lib/spec-test/scoring/archetypes.ts - nothing here changes what
// an archetype MEANS) but re-authors the delivery in second person, with concrete images and
// scenarios instead of clinical vocabulary, aiming for "a smart friend who gets it" rather
// than "a psychometric abstract." Taglines are untouched - short adjective lists were already
// doing their job and are reused from the v1 readings in lib/spec-test/legacy.ts.
//
// Gendered referents use the {token} vocabulary from docs/spec-test-gender-implementation-plan.md
// Phase G2 - see lib/spec-test/gender/terms.ts and render.ts. The verb-agreement rule from that
// phase still applies: a bare {they}/{them} token is never the subject of a present-tense
// finite verb (neutral "they" takes a plural verb, "she"/"he" takes singular) - use "the
// {person}" as the subject, or a modal/passive/past-tense construction, instead.

import { SPEC_TYPE_READINGS } from "@/lib/spec-test/legacy";
import type { ArchetypeKey } from "@/lib/spec-test/taxonomy";

export type ArchetypeReadingV2 = {
  key: ArchetypeKey;
  name: string;
  tagline: string;
  /** report §4 "Core reading". */
  coreReading: string;
  /** report §4 "What this may say about you". */
  whatItSaysAboutYou: string;
  /** report §4 "Likely strength". */
  strength: string;
  /** report §4 "Blind spot". */
  blindSpot: string;
  /** report §4 "Long-term partner brief". */
  longTermFit: string;
  /** report §4 "Growth line". */
  growthPrompt: string;
};

export const ARCHETYPE_READINGS_V2: Record<ArchetypeKey, ArchetypeReadingV2> = {
  quiet_fire: {
    key: "quiet_fire",
    name: "Quiet Fire",
    tagline: SPEC_TYPE_READINGS.quiet_fire.tagline,
    coreReading:
      "You clock the {person} who isn't performing before you clock the one who is - the type who says less than everyone else in the room and somehow ends up the one you remember. That restraint doesn't read as boring to you. It reads as power. You're not chasing mystery for its own sake; you're chasing the feeling that there's a lot happening under a very calm surface.",
    whatItSaysAboutYou:
      "You catch signals other people miss - a look that lingers half a second too long, a text that's exactly the right length and no more. Loud, over-the-top declarations make you suspicious rather than swept off your feet. You want to feel like you earned your way in, because access handed out to everyone doesn't feel like anything at all.",
    strength:
      "You know how to sit with a quiet {person} and actually see {them} - most people don't have the patience for that. You're capable of a loyalty that doesn't announce itself but doesn't waver, either. When you commit, you commit quietly and completely - no dramatic declarations, just consistent, unmistakable presence.",
    blindSpot:
      "Here's the trap: not every quiet {person} is deep. Some are genuinely thoughtful. Others are just avoidant, bad at communicating, or not that into you and too conflict-averse to say so. Mystery makes a great opening line - it's a bad long-term personality if it never turns into anything you actually know. If six months in you still can't name what the {person} actually wants out of life, that's not intrigue anymore - that's a red flag wearing intrigue's clothes.",
    longTermFit:
      "You want someone steady enough to trust and self-possessed enough to keep surprising you: a {person} who protects {their} privacy without turning basic honesty into a scavenger hunt, opens up gradually instead of on command, and can hold real intensity without using silence as a weapon. Someone who can tell you the hard thing directly, then go back to being quietly {themself} - not someone who makes you guess what the hard thing even was.",
    growthPrompt: "Stop asking how strong the pull feels. Start asking what the {person} has actually shown you, on purpose, more than once.",
  },
  soft_landing: {
    key: "soft_landing",
    name: "Soft Landing",
    tagline: SPEC_TYPE_READINGS.soft_landing.tagline,
    coreReading:
      "You melt a little when someone just... remembers things. Texts to check you got home safe. Notices you're off before you say a word. You don't need grand gestures - you need the small, unglamorous, repeated proof that someone's actually paying attention. For you, being taken care of isn't the consolation prize for missing chemistry. It IS the chemistry.",
    whatItSaysAboutYou:
      "You read a room emotionally before you read it any other way. Tone, follow-through, whether someone remembers what you said last week - that's your real test for whether this is going somewhere. You can enjoy the exciting stuff too, but you're not signing up to audition forever for a spot in {personPoss} life.",
    strength:
      "You get that love mostly happens in small, repeated moments, not big ones. You're often the person who makes someone else feel safe enough to finally be honest - that's rarer than it sounds. You don't need chaos to feel like love is real; consistency is romantic to you, not boring.",
    blindSpot:
      "Watch for this: after enough inconsistency, basic decency can start to feel like the love of your life. Being nice to you is the floor, not the ceiling. Warmth without boundaries, follow-through, and actual desire behind it is just... nice. On its own, that's not enough. Ask yourself: would you still want this if it came with less drama to soothe and more ordinary, unremarkable peace?",
    longTermFit:
      "Find someone warm AND sturdy - affectionate, emotionally present, able to say sorry and mean it, but also fully capable of running {their} own life. The right {person} lets you take care of {them} without your care becoming the only thing holding the relationship up. Someone who says thank you for the small things instead of expecting them, and never mistakes your softness for a lack of a spine.",
    growthPrompt: "The safest love isn't the one that needs you the most. It's the one where you're both allowed to need something.",
  },
  electric_charmer: {
    key: "electric_charmer",
    name: "Electric Charmer",
    tagline: SPEC_TYPE_READINGS.electric_charmer.tagline,
    coreReading:
      "You feel attraction like a change in the room's temperature. The {person} who turns a boring party into a good one, who makes small talk feel like flirting, who's built an inside joke with you inside five minutes - that's the one you can't stop watching. You're wired for momentum: if it feels like something is already happening, you're already in.",
    whatItSaysAboutYou:
      "You clock energy before you clock anyone's résumé. Presence, timing, the sense that someone's actually enjoying being there with you - that beats most people's dating checklist. You also want proof that a {person} can show up fully in real life, not just shine when there's an audience.",
    strength: "You make desire feel fun instead of a chore. You're often the one who keeps a relationship from turning into a shared to-do list - you bring the spark back on purpose. You're the reason a lot of ordinary nights turn into stories people actually tell later.",
    blindSpot:
      "Chemistry tells you something is happening. It doesn't tell you who you're dealing with. Social ease can feel exactly like intimacy, because both feel effortless - but the real test is whether the {person} is still generous and reliable with no audience and nothing exciting on the table. Ask what's left when the lights are off and it's just the two of you doing nothing in particular.",
    longTermFit:
      "Look for spark with staying power: someone socially alive, openly into you, playful - who still shows up when plans fall through, conflict happens, or life gets boring for a while. Someone who matches your energy without needing to perform it 24/7, and doesn't quietly resent you for being the fun one.",
    growthPrompt: "Don't kill the spark. Just check whether it's attached to a {person} who can still keep a promise after the party's over.",
  },
  ambitious_icon: {
    key: "ambitious_icon",
    name: "Ambitious Icon",
    tagline: SPEC_TYPE_READINGS.ambitious_icon.tagline,
    coreReading:
      "Competence turns you on. Not necessarily money - direction. You notice the {person} who's clearly building something, who has standards, who looks like {they} chose this life instead of falling into it. Watching someone be good at being {themself} is, for you, one of the most attractive things a human can do.",
    whatItSaysAboutYou:
      "For you, respect and desire run on the same wire. You take partnership seriously enough to actually picture how two lives would fit together in practice - not just how a first date would go. How a {person} carries {their} reputation, {their} discipline, {their} choices - all of it quietly shapes how attracted to {them} you feel.",
    strength: "You judge potential by behavior, not promises, so you're hard to fool with talk. You're genuinely good at supporting someone's real goals without shrinking your own. You're genuinely motivating to be around - people tend to raise their own bar just from watching how you operate.",
    blindSpot:
      "Being impressive in public says nothing about how someone treats people in private. Direction can curdle into control. High standards can turn into a permanent performance review. And polish is a great way to hide the fact that someone's actually bad at repairing a fight. Ask whether {they} can lose, be wrong, or need help without it costing {them} {their} whole sense of self.",
    longTermFit:
      "You want capable AND generous - a {person} who respects your ambitions as much as {their} own, shares power instead of hoarding it, and knows that success doesn't get {them} out of being tender, accountable, and present. Someone who's proud of you without needing credit for it, and doesn't quietly compete with you when you're both trying to win.",
    growthPrompt: "The right {person} should impress you. You shouldn't have to work for {them} to remain worthy of being loved.",
  },
  brilliant_tease: {
    key: "brilliant_tease",
    name: "Brilliant Tease",
    tagline: SPEC_TYPE_READINGS.brilliant_tease.tagline,
    coreReading:
      "Words get you before looks do. A sharp comment, an unexpected question, a joke landed at exactly the right second - that's what changes a face for you. You want a {person} who can follow your train of thought without you slowing down for {them}, who can push back without flattening you, and who treats a conversation like a game you're both trying to win.",
    whatItSaysAboutYou:
      "Being understood, mentally, is intimacy to you - maybe the main kind. Small talk, rehearsed lines, and conversations that never go anywhere new lose you fast. Humor is also your real test: can this {person} read subtext, keep up, actually get the joke behind the joke?",
    strength: "You keep things alive intellectually in a way a lot of relationships never manage. You build your own private language with {people}, and that in-joke-per-minute energy is genuinely rare. You make people feel sharper just by being around you - that's a real gift, not just entertainment.",
    blindSpot:
      "Being quick with words isn't the same as being emotionally intelligent. Wit can just as easily deflect, seduce, dominate a room, or hide contempt behind a punchline. A {person} can get every reference you make and still completely miss what you actually need. If every serious conversation somehow turns into a bit, ask what's actually being avoided underneath the joke.",
    longTermFit:
      "Find a sharp mind attached to an open heart: curious, funny, quick - but also able to drop the act, listen without prepping a comeback, and stay kind once the jokes run out. Someone who can go toe-to-toe with you and then, just as easily, put the sparring down and hold you.",
    growthPrompt: "Notice who makes you laugh. Then choose, among them, whoever also makes honesty feel safe.",
  },
  beautiful_mystery: {
    key: "beautiful_mystery",
    name: "Beautiful Mystery",
    tagline: SPEC_TYPE_READINGS.beautiful_mystery.tagline,
    coreReading:
      "You're drawn to composition - the way a {person} holds {themself}, dresses, edits {their} own story. Not because it's flashy, but because it's clearly on purpose. A {person} who isn't handing {their} whole story to anyone who asks makes your attention feel earned instead of automatic. For you, attraction builds slowly, in details: the unexpected softness, the second look, the life you can sense behind a very controlled surface.",
    whatItSaysAboutYou:
      "You read style as information - presentation tells you something real about taste, identity, self-respect. You've probably also got a rich imagination: the parts you don't know yet leave room for possibility, and that gap is half the appeal.",
    strength: "You appreciate beauty that goes beyond the obvious, and you get that pacing itself can be erotic. You're genuinely good at letting a {person} reveal {themself} on {their} own timeline instead of forcing it. You make people want to earn your attention instead of assuming they already have it - and that's rarer than it sounds.",
    blindSpot: "Being selective isn't the same as having good character, and a polished surface can throw a halo over qualities that have nothing to do with it. A gorgeous, controlled exterior can absolutely coexist with dishonesty, vanity, or straight-up bad treatment. Ask what you actually know about {them}, not what you've quietly filled in yourself.",
    longTermFit:
      "Look for intrigue that actually turns into intimacy over time - a {person} who's stylish, independent, unhurried about opening up, but who gets clearer the longer you know {them}, not more confusing. Someone whose surface and substance eventually match - not someone who stays impressive purely because you never got close enough to check.",
    growthPrompt: "Let looks ask the first question. Let behavior answer the ones that actually matter.",
  },
  free_spirit: {
    key: "free_spirit",
    name: "Free Spirit",
    tagline: SPEC_TYPE_READINGS.free_spirit.tagline,
    coreReading:
      "You want a relationship to make your life bigger, not smaller. You notice the {person} with the stories, the weird hobby, the ability to blow up a routine without asking anyone's permission first. It's not really adventure you're chasing - it's possibility, the sense that there's always another door.",
    whatItSaysAboutYou:
      "Autonomy is basically wired into your desire. You need love to feel like it opens things up rather than fences you in. Predictable can feel comforting at the start, then start to feel like a cage the second the relationship stops producing anything new.",
    strength: "You bring flexibility, curiosity, and reinvention to whoever you're with. You're often the one who helps a {person} get less afraid of change, and you keep long relationships from collapsing into pure logistics. You're often the one who talks someone else into the trip, the risk, or the leap they secretly wanted to take anyway.",
    blindSpot:
      "Unpredictability can fake aliveness pretty convincingly. A {person} who resists every kind of structure will eventually make real closeness impossible, because trust needs some consistency to actually build on. Ask whether leaving room to run is actually freedom, or just a socially acceptable way to never fully land anywhere.",
    longTermFit: "Find an adventurer with an anchor: open, expressive, independent, but also able to plan things, repair a fight, commit to something, and grow with you - not just away from you. Someone who can say \"let's go\" as easily as \"let's stay,\" and doesn't need every plan pinned down to feel safe.",
    growthPrompt: "Freedom in love isn't the absence of promises. It's making promises that still leave both of you fully yourselves.",
  },
  grounded_equal: {
    key: "grounded_equal",
    name: "Grounded Equal",
    tagline: SPEC_TYPE_READINGS.grounded_equal.tagline,
    coreReading:
      "Evidence turns you on more than promises do. You notice the {person} who follows through on what {they} said, treats people the same whether it's convenient or not, and can build a calm, good life without manufacturing a crisis every other week. Equality itself is the attraction: not a rescue project, not someone to worship - just two people on the same level.",
    whatItSaysAboutYou:
      "You get that most of a relationship happens on ordinary Tuesdays, not big nights out. Fairness and shared values matter to you because you're not just picturing dates with a {person} - you're picturing making decisions next to {them}.",
    strength: "You can tell the difference between attention and actual investment, and between drama and real depth. You build trust through reciprocity and treat conflict like a shared problem, not a fight to win. People trust you fast, and that trust is usually earned rather than given away for free.",
    blindSpot: "Low drama is healthy. Low emotional range isn't the same thing, and it's not automatically healthy just because it's calm. Being reliable doesn't cancel out the need for play, desire, admiration, or the occasional surprise. Calm shouldn't come at the cost of never feeling swept off your feet - ask when you last actually felt that, not just comfortable.",
    longTermFit:
      "You want a real teammate who still has a pulse: dependable, fair, aligned with you on the big things, but also affectionate, willing to initiate, and able to bring enough novelty that the relationship doesn't turn into a shared spreadsheet. Someone who brings the occasional plot twist on purpose, so steady doesn't quietly become synonymous with stagnant.",
    growthPrompt: "You don't need chaos to feel chemistry. You do need to keep choosing to feel alive inside something stable.",
  },
};
