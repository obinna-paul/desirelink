import "server-only";

// server-only. Per-archetype narrative fragments transcribed from docs/spec-test-research.md
// §4 "Provisional narrative library for the current eight Specs" - these supersede the v1
// copy inlined in lib/spec-test/legacy.ts's SPEC_TYPE_READINGS for any v2 result. Taglines
// are reused from the v1 readings rather than re-authored: the report doesn't restate a
// short tagline per archetype in §4 (it only gives full paragraphs), and the v1 one-liners
// already frame the same eight archetype names accurately.

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
      "You notice the person who does not spend the whole room trying to be noticed. Their restraint reads as self-command; their privacy suggests there is more to discover. You are not attracted to emptiness. You are attracted to compression—emotion, desire or intelligence that seems powerful precisely because it is not spilling everywhere.",
    whatItSaysAboutYou:
      "You are sensitive to small signals: a held gaze, a precise sentence, the difference between shyness and confidence. Loud performance can make you suspicious. You want access that feels earned, because earned access feels more meaningful than attention freely distributed to everyone.",
    strength:
      "You can appreciate subtle people without demanding constant performance. You often recognize depth others overlook and may be capable of loyalty that is quiet but intense.",
    blindSpot:
      "You can mistake emotional opacity for emotional depth. Some people are private because they are discerning; others are simply unavailable, conflict-avoidant or unwilling to communicate. Mystery should eventually become knowledge.",
    longTermFit:
      "The strongest fit is self-possessed and emotionally consistent: someone who respects privacy without making intimacy a guessing game, reveals themselves gradually but answers direct questions, and can hold intensity without using silence as power.",
    growthPrompt: "Do not ask only, “How strongly do I feel?” Ask, “What have they consistently shown me?”",
  },
  soft_landing: {
    key: "soft_landing",
    name: "Soft Landing",
    tagline: SPEC_TYPE_READINGS.soft_landing.tagline,
    coreReading:
      "Your attraction system relaxes when care is unmistakable. You notice the person who remembers details, checks that you arrived safely, makes affection feel natural, and creates room for emotion without turning it into a problem to solve. For you, tenderness is not the consolation prize after chemistry; tenderness can be chemistry.",
    whatItSaysAboutYou:
      "You are highly responsive to emotional climate. You likely read tone, consistency and consideration as signs of seriousness. Even when you enjoy excitement, you do not want to audition indefinitely for a place in someone's life.",
    strength:
      "You understand that love is enacted in small, repeated moments. You are often capable of warmth, repair and reassurance, and you may help partners feel safe enough to become more honest.",
    blindSpot:
      "Relief can masquerade as compatibility. After inconsistency, basic kindness can feel extraordinary. Warmth matters, but it must coexist with boundaries, accountability, desire and adult self-responsibility.",
    longTermFit:
      "Choose warmth with backbone: affectionate, emotionally available, able to apologize, but capable of managing their own life. The right partner receives your care without making your care the entire structure holding them up.",
    growthPrompt: "The safest love is not the one that needs you most; it is the one in which both people can give and receive.",
  },
  electric_charmer: {
    key: "electric_charmer",
    name: "Electric Charmer",
    tagline: SPEC_TYPE_READINGS.electric_charmer.tagline,
    coreReading:
      "You feel attraction as momentum. The person who makes a dull room come alive, turns an ordinary exchange into flirtation, or creates a private joke within minutes has an advantage with you. You are drawn to social courage and emotional voltage—the feeling that something is already happening.",
    whatItSaysAboutYou:
      "Your nervous system notices energy before biography. You value presence, timing and reciprocal enthusiasm. You may also want proof that a partner can enter life fully rather than observing it from the edges.",
    strength: "You permit desire to be joyful. You can create play, initiate connection and prevent relationships from becoming purely administrative.",
    blindSpot:
      "Chemistry is information, not a full background check. Social fluency can look like intimacy because both create ease. The question is whether the person remains generous, accountable and interested when there is no audience and nothing exciting to win.",
    longTermFit:
      "The best fit has sparkle and follow-through: socially alive, sexually expressive and playful, but dependable when plans, conflict and ordinary responsibilities arrive.",
    growthPrompt: "Do not extinguish the spark. Ask whether it is attached to a person who can keep a promise after the party ends.",
  },
  ambitious_icon: {
    key: "ambitious_icon",
    name: "Ambitious Icon",
    tagline: SPEC_TYPE_READINGS.ambitious_icon.tagline,
    coreReading:
      "Respect is one of your gateways to desire. You notice competence, standards, direction and visible self-possession. It is not necessarily money that attracts you; it is evidence that a person can choose a path, carry weight and create a life rather than waiting for life to happen.",
    whatItSaysAboutYou:
      "Attraction and admiration are closely linked. You may take partnership seriously and imagine how two lives will fit in practice. A person's decisions, reputation and discipline can affect how physically attractive they become to you.",
    strength: "You see potential in terms of behavior, not only promises. You can build deliberately, support meaningful goals and respect a partner without diminishing yourself.",
    blindSpot:
      "Competence in public does not guarantee generosity in private. Direction can become control; high standards can become chronic evaluation; polish can conceal an inability to repair harm.",
    longTermFit:
      "Choose capable and emotionally generous. They should respect your goals, admire you back, share power, and know that success does not exempt them from tenderness, accountability or presence.",
    growthPrompt: "The right person should be impressive to you, but you should not have to become an employee in their life to remain worthy of them.",
  },
  brilliant_tease: {
    key: "brilliant_tease",
    name: "Brilliant Tease",
    tagline: SPEC_TYPE_READINGS.brilliant_tease.tagline,
    coreReading:
      "Your attraction often begins in language. A sharp observation, unexpected question or perfectly timed joke can alter a face for you. You are drawn to someone who can follow the leap in your mind, challenge you without flattening you, and make conversation feel like both play and discovery.",
    whatItSaysAboutYou:
      "Being mentally met is a form of intimacy. You probably dislike scripts, shallow praise and conversation that never develops texture. Humor may also help you test flexibility, confidence and whether another person can perceive subtext.",
    strength: "You can sustain curiosity and make a relationship intellectually alive. You tend to value individuality and may create unusually rich private languages with partners.",
    blindSpot:
      "Verbal intelligence is not emotional intelligence. Wit can deflect, seduce, dominate or conceal contempt. Someone who understands your references may still fail to understand your needs.",
    longTermFit:
      "Choose a lively mind with an accessible heart: curious, funny and articulate, but able to speak plainly, listen without preparing a comeback, and remain kind when humor is no longer enough.",
    growthPrompt: "Notice who can make you laugh; choose among them by who can also make honesty feel safe.",
  },
  beautiful_mystery: {
    key: "beautiful_mystery",
    name: "Beautiful Mystery",
    tagline: SPEC_TYPE_READINGS.beautiful_mystery.tagline,
    coreReading:
      "You are drawn to composition: style, restraint, taste, bearing and the sense that a person is not immediately available for mass interpretation. Their selectivity makes attention feel meaningful. Attraction grows through detail—the second look, the unexpected softness, the life behind a carefully held surface.",
    whatItSaysAboutYou:
      "You perceive aesthetics as information. Presentation can signal discernment, identity and self-respect. You may also have a strong imaginative life; what is not yet known creates room for possibility.",
    strength: "You appreciate beauty beyond conventional attractiveness and understand the erotic value of pacing. You may be good at allowing another person to unfold without forcing instant disclosure.",
    blindSpot: "Selectivity is not character, and aesthetics can generate a halo around unrelated qualities. An elegant surface can coexist with evasiveness, vanity or poor treatment.",
    longTermFit:
      "Choose intrigue that becomes intimacy. They can be stylish, independent and slow to reveal themselves, but should become clearer—not more confusing—as trust grows.",
    growthPrompt: "Let beauty invite the first question. Let behavior answer the important ones.",
  },
  free_spirit: {
    key: "free_spirit",
    name: "Free Spirit",
    tagline: SPEC_TYPE_READINGS.free_spirit.tagline,
    coreReading:
      "You want connection to enlarge life. You notice expressive people with stories, experiments, unusual interests and an ability to disrupt routine without demanding permission from the room. The attraction is not only to adventure; it is to possibility.",
    whatItSaysAboutYou:
      "Autonomy matters to your desire. You may need to feel that love opens doors rather than closes them. Predictability can feel safe at first and confining later if the relationship stops producing growth.",
    strength: "You bring flexibility, curiosity and reinvention. You can help a partner become less afraid of change and keep long-term love from shrinking into logistics.",
    blindSpot:
      "Unpredictability can imitate aliveness. A person who resists every structure may eventually make intimacy impossible, because trust needs enough continuity to accumulate.",
    longTermFit: "Choose an adventurer with an anchor: open-minded, expressive and independent, but able to plan, repair, commit and support both shared and separate growth.",
    growthPrompt: "Freedom in love is not the absence of promises; it is the ability to make promises that leave both people fully alive.",
  },
  grounded_equal: {
    key: "grounded_equal",
    name: "Grounded Equal",
    tagline: SPEC_TYPE_READINGS.grounded_equal.tagline,
    coreReading:
      "You are attracted to evidence. The person does what they said, treats people consistently, contributes without scorekeeping, and can build a calm life without manufacturing emotional weather. Equality itself is attractive: neither rescuer nor project, neither fan nor authority.",
    whatItSaysAboutYou:
      "You understand that ordinary days are the majority of a relationship. Shared values, fairness and practical compatibility matter because you imagine not only dating someone but making decisions beside them.",
    strength: "You can distinguish attention from investment and drama from depth. You are well positioned to build trust through reciprocity and to approach conflict as a shared problem.",
    blindSpot: "Low drama is healthy; low emotional range is not automatically healthy. Reliability does not remove the need for play, admiration, physical desire or surprise.",
    longTermFit:
      "Choose a true teammate with a pulse: dependable, fair and values-aligned, but capable of affection, initiative and enough novelty to keep partnership from becoming administration.",
    growthPrompt: "You do not need chaos to create chemistry. You do need to keep choosing aliveness inside stability.",
  },
};
