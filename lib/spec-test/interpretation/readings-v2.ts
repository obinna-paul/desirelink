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
      "Picture a party. Someone's telling a loud story in the middle of the room, and someone else is by the drinks table, saying maybe four words all night, but somehow you know exactly where that second {person} is at all times. That's the pull. You clock the {person} who isn't performing before you clock the one who is, and the quiet doesn't read as awkward or boring, it reads as depth. You've decided, probably without ever saying it out loud, that the loudest {person} in the room is usually telling you the least, and the quiet one is holding something back on purpose. You're not chasing mystery for its own sake. You're chasing the feeling that there's a lot happening under a very calm surface, and that you might be one of the only ones who gets to see it.",
    whatItSaysAboutYou:
      "You're the {person} at the table who notices the half-second pause before someone answers a question, or the text that's exactly three words long when it could have been ten. Everyone else missed it. You didn't. This is real pattern-recognition, not overthinking, and it probably comes from spending a lot of time paying close attention to people instead of just talking at them. It also means big, loud declarations don't land the way they're supposed to. A grand gesture in week two doesn't feel romantic to you, it feels like a performance for an audience, and you start wondering who else has seen the exact same one. What actually gets you is access. A door that opens a little further than it did last time, offered to you specifically, not handed out to whoever happened to be standing nearby.",
    strength:
      "Most people get bored or restless around someone who doesn't talk much, and they either fill the silence or wander off toward someone louder. You do neither. You can sit across from a quiet {person} for an hour and actually see {them}, not just wait {them} out, and that patience is rarer than it sounds and genuinely hard to fake. Once you're in, you're the {person} who remembers what was said three months ago without being reminded, who shows up the same way whether anyone's watching or not. Your loyalty doesn't come with a highlight reel. It just quietly doesn't move.",
    blindSpot:
      "Here's the trap, and it's a real one: not every quiet {person} is deep. Some are genuinely thoughtful and just need time to open up. Others are avoidant, bad at communicating, or simply not that into you and too conflict-averse to ever say so out loud, and from the outside those two things can look identical for months. Say you've been seeing someone for half a year and you still couldn't answer a simple question about what {they} actually want out of life, what scares {them}, what {they}'re working toward. That's not mystery anymore. Mystery is a great opening line. As a permanent personality, it usually just means the {person} hasn't told you, and you've been quietly doing the work of inventing a reason why.",
    longTermFit:
      "You want someone steady enough to trust and self-possessed enough to keep surprising you months in, not just on the first date. Look for a {person} who protects {their} privacy without turning basic honesty into a scavenger hunt, someone who opens up gradually, on {their} own timeline, but does actually open up, rather than staying permanently just out of reach. The real test shows up in conflict: can this {person} tell you the hard thing directly, sit in the discomfort of saying it, and then go back to being quietly {themself}, instead of going cold and making you guess what you did wrong. That's the difference between someone quietly deep and someone quietly checked out.",
    growthPrompt: "Stop asking how strong the pull feels. Start asking what the {person} has actually shown you, on purpose, more than once.",
  },
  soft_landing: {
    key: "soft_landing",
    name: "Soft Landing",
    tagline: SPEC_TYPE_READINGS.soft_landing.tagline,
    coreReading:
      "You melt a little when someone just... remembers things. Not your birthday, everyone remembers that. The small stuff: that you had a rough meeting on Tuesday, that you take your coffee a specific way, that you mentioned once, in passing, that a certain song makes you sad. A {person} who texts to check you got home safe, or clocks you're off before you've said a single word about it, does more for you than a {person} who shows up with flowers and a plan for the perfect night. You don't need grand gestures. You need the small, unglamorous, repeated proof that someone's actually paying attention when nothing dramatic is happening. For you, being taken care of isn't the consolation prize you settle for when the chemistry isn't quite there. It IS the chemistry, and honestly, it always was.",
    whatItSaysAboutYou:
      "Walk into a room with you and you'll clock the emotional temperature before you clock anything else, who's tense, who's checked out, who's actually glad to be there. That same radar runs on every date. Tone matters more to you than the words themselves. Follow-through matters more than promises. Whether someone remembers what you told them last week, unprompted, tells you more than a whole night of good conversation. You can enjoy the exciting stuff too, the spontaneity, the spark, but you're not interested in auditioning forever for a permanent spot in {personPoss} life. At some point you want to actually be let in, not just kept pleasantly hopeful.",
    strength:
      "You get, on some level most people never quite land on, that love mostly happens in small, repeated moments, not the big cinematic ones. A million quiet Tuesdays add up to more than one perfect anniversary. That understanding makes you the {person} someone finally feels safe enough to be honest with, often for the first time in a while, because you're not going to flinch, panic, or punish them for it. That's a genuinely rare gift, not a small one. You also don't need chaos to feel like love is real. Consistency doesn't bore you. It's the whole point.",
    blindSpot:
      "Watch for this, because it's a real trap and it's sneaky: after enough people who were inconsistent, careless, or hard to read, basic decency can start to feel like the love of your life. A {person} who texts back at a normal hour and doesn't disappear for three days starts to feel like a whole relationship, when really that's just the floor, not the ceiling. Warmth without boundaries, without follow-through, without any real desire behind it, is just... nice. On its own, nice is not enough to build a life on. Ask yourself honestly: would you still want this {person} if the relationship came with less drama for you to soothe and more ordinary, unremarkable peace? If the honest answer is that the peace itself feels boring, that's worth sitting with.",
    longTermFit:
      "Find someone warm AND sturdy, not just one or the other. Affectionate, emotionally present, actually able to say sorry and mean it, but also fully capable of running {their} own life without handing you the job. The right {person} lets you take care of {them} sometimes, because you're good at it and you enjoy it, without your care quietly becoming the only thing holding the whole relationship up. Someone who says thank you for the small things instead of expecting them as a baseline, and who never, ever mistakes your softness for a lack of a spine.",
    growthPrompt: "The safest love isn't the one that needs you the most. It's the one where you're both allowed to need something.",
  },
  electric_charmer: {
    key: "electric_charmer",
    name: "Electric Charmer",
    tagline: SPEC_TYPE_READINGS.electric_charmer.tagline,
    coreReading:
      "You feel attraction like an actual change in the room's temperature, not a slow build, an immediate shift. The {person} who turns a dead party into a good one just by walking in, who somehow makes small talk feel like flirting, who's built an inside joke with you inside five minutes flat, that's the one you can't stop watching all night. You're wired for momentum. If it already feels like something is happening between you, you're already in, fully, before you've even worked out what \"it\" is. Slow burns rarely get the chance to prove themselves to you, because by the time they'd get going, someone with faster spark already has your attention.",
    whatItSaysAboutYou:
      "You clock energy before you clock a résumé, a job title, or anything on paper. Presence, timing, the unmistakable sense that someone's actually enjoying being there with you right now, that beats most people's whole dating checklist combined. It's why a genuinely charming {person} with nothing else going for {them} can hold your attention longer than someone objectively \"better\" on paper who's a little flat in person. But you're also not naive about it. You want proof that a {person} can show up fully in real life, not just shine when there's an audience to perform for, because you've learned the hard way that charm in public and character in private aren't the same skill.",
    strength:
      "You make desire feel fun instead of a chore, which sounds obvious until you notice how many couples lose that completely. You're often the one who keeps a relationship from quietly turning into a shared to-do list, texting logistics and nothing else, because you bring the spark back on purpose, deliberately, even on a random Tuesday. You're the reason a forgettable Wednesday night turns into a story someone tells at dinner two years later. That's a genuine skill, not just personality.",
    blindSpot:
      "Chemistry tells you something is happening. It tells you nothing about who you're actually dealing with. Social ease can feel exactly like real intimacy, because both feel effortless in the moment, and it's easy to mistake a {person} who's good in a room for a {person} who's good for you. The real test isn't the party. It's the Tuesday after, when there's no audience, nothing exciting planned, and it's just the two of you doing laundry or waiting for a table. Ask yourself honestly what's left in that moment. If the answer is \"not much,\" the spark was real, but it might not have had much attached to it.",
    longTermFit:
      "Look for spark with actual staying power. Someone socially alive, openly into you, genuinely playful, but who still shows up fully when plans fall through last minute, when an actual conflict happens, or when life just gets a little boring for a stretch. Someone who can match your energy without needing to perform it every single day, and who doesn't quietly start resenting you for being the fun one while {they} carry everything unglamorous alone.",
    growthPrompt: "Don't kill the spark. Just check whether it's attached to a {person} who can still keep a promise after the party's over.",
  },
  ambitious_icon: {
    key: "ambitious_icon",
    name: "Ambitious Icon",
    tagline: SPEC_TYPE_READINGS.ambitious_icon.tagline,
    coreReading:
      "Competence turns you on, and it's not really about money, it's about direction. You notice the {person} in the room who's clearly building something on purpose, who has actual standards {they} hold to, who looks like {they} chose this specific life rather than just drifting into whatever happened next. A well-run life is, to you, genuinely more attractive than a perfect face. Watching someone be unapologetically skilled at whatever matters to {them}, whether that's a career, a craft, or just how {they} treat people, is one of the most attractive things a human being can do in front of you.",
    whatItSaysAboutYou:
      "For you, respect and desire run on the same wire, not two separate ones. You take the idea of partnership seriously enough to actually picture how two full lives would fit together in practice, schedules, ambitions, where you'd both end up in five years, not just how a good first date would go. How a {person} carries {their} reputation, handles {their} own discipline, makes {their} choices when no one's grading {them}, all of it quietly shapes how attracted to {them} you actually feel, sometimes more than looks do.",
    strength:
      "You judge potential by behavior, not by promises, which makes you genuinely hard to fool with talk alone. Someone can tell you all the right things, but you're watching what {they} actually do with {their} time, and that's what you believe. You're also genuinely good at supporting someone's real goals without shrinking your own in the process, which is a harder balance than it sounds. People tend to raise their own bar just from watching how you operate, whether or not you ever say a word about it.",
    blindSpot:
      "Being impressive in public says nothing about how someone treats people in private, and that gap can be a lot bigger than it looks from the outside. Direction can curdle into control if it's never checked. High standards can quietly turn a relationship into a permanent performance review, where you're always slightly being evaluated. And polish is a genuinely great way to hide the fact that someone's actually bad at repairing a fight once the shine wears off. Watch what happens the one time this {person} loses, is flatly wrong about something, or needs real help. Ask whether it costs {them} {their} entire sense of self, or whether {they} can just be human about it and move on.",
    longTermFit:
      "You want capable AND generous, not one at the cost of the other. A {person} who respects your ambitions exactly as much as {their} own, shares power instead of quietly hoarding it, and understands that success in a career doesn't buy {them} an exemption from being tender, accountable, and actually present at home. Someone who's genuinely proud of you without needing credit for it, and who doesn't start quietly competing with you the moment you're both trying to win at the same time.",
    growthPrompt: "The right {person} should impress you. You shouldn't have to work for {them} to remain worthy of being loved.",
  },
  brilliant_tease: {
    key: "brilliant_tease",
    name: "Brilliant Tease",
    tagline: SPEC_TYPE_READINGS.brilliant_tease.tagline,
    coreReading:
      "Words get you before looks ever do. A sharp comment dropped at exactly the right second, an unexpected question that catches you off guard in a good way, a joke that lands somewhere you didn't see coming, that's what changes a face for you, sometimes mid-conversation, sometimes before you've even properly looked at the {person}. You want someone who can follow your train of thought without you slowing down to explain it, who can push back and disagree with you without flattening you in the process, and who treats a good conversation like a game you're both genuinely trying to win.",
    whatItSaysAboutYou:
      "Being understood, mentally, is intimacy to you, arguably the main kind, more than a hand held or a look across a room. Small talk loses you fast, rehearsed lines lose you faster, and a conversation that circles the same three topics every time will quietly bore you out of interest even if the {person} is otherwise great. Humor is also your real test, and it's a stricter one than people realize. Can this {person} read subtext without it being spelled out, keep pace when you speed up, actually get the joke behind the joke instead of just the joke itself?",
    strength:
      "You keep things alive intellectually in a way a lot of relationships quietly stop managing after year one. You build your own private language with {people} fast, references, bits, a shorthand nobody else would get, and that constant in-joke energy is genuinely rare in a long relationship. You also tend to make people feel sharper and funnier just by being around you, which is a real gift, not just entertainment on the side.",
    blindSpot:
      "Being quick with words isn't automatically the same thing as being emotionally intelligent, and it's easy to mix the two up, in yourself and in whoever you're dating. Wit can just as easily deflect a real question, seduce a whole room, dominate a conversation, or hide something closer to contempt behind a well-timed punchline. A {person} can get every single reference you make and still completely miss what you actually need in a hard moment. If every serious conversation you try to have somehow turns into a bit within thirty seconds, that's worth noticing. Ask what's actually being avoided underneath the joke, in you and in {them}.",
    longTermFit:
      "Find a sharp mind attached to an open heart: curious, funny, quick on {their} feet, but also able to drop the act entirely when it matters, listen without already prepping a comeback, and stay kind once the jokes run out for the night. Someone who can go toe-to-toe with you across a whole dinner and then, just as easily, put the sparring down and simply hold you, no punchline required.",
    growthPrompt: "Notice who makes you laugh. Then choose, among them, whoever also makes honesty feel safe.",
  },
  beautiful_mystery: {
    key: "beautiful_mystery",
    name: "Beautiful Mystery",
    tagline: SPEC_TYPE_READINGS.beautiful_mystery.tagline,
    coreReading:
      "You're drawn to composition, the way a {person} holds {themself}, dresses, edits {their} own story before {they} ever tell it to you. Not because any of it is flashy, but because it's clearly, visibly on purpose, like someone who's thought carefully about who {they} want to be. A {person} who isn't handing {their} whole story to anyone who asks makes your attention feel earned instead of automatic, like you noticed something not everyone gets to see. For you, attraction builds slowly, in details: an unexpected flash of softness in someone who seemed untouchable, a second look that means more than the first one, the sense of a whole life running quietly behind a very controlled surface.",
    whatItSaysAboutYou:
      "You read style as information. Presentation tells you something real about a {person}'s taste, identity, and self-respect, and you don't think that's shallow, you think it's honest, since people do choose how they present themselves. You've probably also got a genuinely rich imagination. The parts of a {person} you don't know yet leave room for possibility, and that gap between what you can see and what you can't is half the appeal, more where that came from, on {their} own timeline.",
    strength:
      "You appreciate beauty that goes beyond the obvious surface read, and you genuinely get that pacing itself can be erotic, that the reveal can matter more than what's revealed. You're also good, unusually good, at letting a {person} open up on {their} own timeline instead of forcing the pace before {they}'re ready. You make people want to earn your attention instead of assuming they already have it, and that's a rarer quality than it sounds, most people give attention away for free.",
    blindSpot:
      "Being selective isn't the same thing as having good character, even though the two can look identical from a distance. A polished, composed surface can throw a halo over qualities that have nothing to do with it at all, making you assume depth or kindness that was never actually demonstrated. A gorgeous, controlled exterior can absolutely coexist with dishonesty, vanity, or straight-up bad treatment of the people closest to it. Try this test: write down what you actually know about {them}, facts, things {they}'ve told you or shown you, versus what you've quietly filled in yourself. The gap between those two lists is exactly where the risk lives.",
    longTermFit:
      "Look for intrigue that actually turns into real intimacy over time, not intrigue that just stays intrigue forever. A {person} who's stylish, independent, unhurried about opening up, but who gets clearer the longer you know {them}, not more confusing or more evasive. Someone whose surface and substance eventually match up. Not someone who manages to stay impressive purely because you never quite got close enough to check.",
    growthPrompt: "Let looks ask the first question. Let behavior answer the ones that actually matter.",
  },
  free_spirit: {
    key: "free_spirit",
    name: "Free Spirit",
    tagline: SPEC_TYPE_READINGS.free_spirit.tagline,
    coreReading:
      "You want a relationship to make your life bigger, not smaller, and you can feel almost immediately which direction someone's pulling you in. You notice the {person} with the good stories, the slightly odd hobby nobody else has, the ability to blow up a boring routine without asking anyone's permission first. It's not really adventure itself you're chasing, exactly. It's possibility, the sense that there's always another door somewhere, even if you never walk through it.",
    whatItSaysAboutYou:
      "Autonomy is basically wired straight into your desire, not separate from it. You need love to feel like it opens your life up rather than fencing it in, even a little. Predictable can feel genuinely comforting at the very start of something, the safety of knowing what's coming next, but it can flip fast, turning into a cage the second the relationship stops producing anything new to look forward to.",
    strength:
      "You bring flexibility, curiosity, and a genuine willingness to reinvent things to whoever you're with. You're often the one who helps a {person} get less afraid of change generally, not just in the relationship. You keep long relationships from quietly collapsing into pure logistics, the shared calendar and nothing else. You're usually the one who talks someone else into the trip, the risk, or the leap {they} secretly wanted to take anyway but needed a push to actually book.",
    blindSpot:
      "Unpredictability can fake aliveness pretty convincingly, which makes it hard to tell the difference from the inside. A {person}, including possibly you, who resists every kind of structure will eventually make real closeness impossible, simply because trust needs at least some consistency to actually build on top of. Ask yourself honestly whether leaving room to run is real freedom, or whether it's become a socially acceptable way to never fully land anywhere with anyone.",
    longTermFit:
      "Find an adventurer with an anchor: open, expressive, independent, but also genuinely able to plan things ahead of time, repair a fight instead of just moving past it, commit to something real, and grow alongside you instead of away from you. Someone who can say \"let's go\" just as easily as \"let's stay,\" and who doesn't need every single plan pinned down in advance to feel safe in the relationship.",
    growthPrompt: "Freedom in love isn't the absence of promises. It's making promises that still leave both of you fully yourselves.",
  },
  grounded_equal: {
    key: "grounded_equal",
    name: "Grounded Equal",
    tagline: SPEC_TYPE_READINGS.grounded_equal.tagline,
    coreReading:
      "Evidence turns you on more than promises ever do. You notice the {person} who actually follows through on what {they} said {they}'d do, who treats people the same whether it's convenient in the moment or not, and who can build a calm, good life without manufacturing some new crisis every other week just to feel something. Equality itself is the attraction here. Not a rescue project you'd have to manage, not someone to put on a pedestal and worship, just two people standing on the same level, looking at the same life.",
    whatItSaysAboutYou:
      "You get, more clearly than most, that a relationship mostly happens on ordinary Tuesdays, not the big nights out everyone else posts about. Fairness and shared values matter enormously to you, because you're not just picturing good dates with a {person}, you're already picturing making real decisions next to {them}, splitting bills, choosing where to live, figuring out a hard year together.",
    strength:
      "You can tell the difference between attention and actual investment, and the difference between drama and real depth, two distinctions a lot of people never quite learn to make. You build trust through reciprocity, matching effort for effort, and you treat conflict like a shared problem to solve together rather than a fight either of you needs to win. People tend to trust you fast, and unlike a lot of fast trust, this kind is usually earned, not just given away for free.",
    blindSpot:
      "Low drama is healthy, genuinely. Low emotional range is a completely different thing, and it's not automatically healthy just because it's calm and quiet. Being reliable doesn't cancel out the actual need for play, desire, admiration, or the occasional surprise that has nothing to do with logistics. Calm shouldn't come at the cost of never once feeling swept off your feet. Ask yourself honestly when you last actually felt that with this {person}, not just comfortable, not just fine, actually swept up.",
    longTermFit:
      "You want a real teammate who still has a pulse. Dependable, fair, aligned with you on the things that actually matter long-term, but also affectionate, willing to initiate instead of always waiting to be asked, and able to bring enough novelty that the relationship doesn't quietly turn into a shared spreadsheet of chores and errands. Someone who brings the occasional plot twist on purpose, so steady never quietly becomes a synonym for stagnant.",
    growthPrompt: "You don't need chaos to feel chemistry. You do need to keep choosing to feel alive inside something stable.",
  },
};
