// Client-safe official v3 item bank. The scoring design stays balanced, but the copy is
// deliberately conversational: short options, familiar situations, and light Nigerian
// context without requiring slang knowledge. Gender tokens are rendered after the taker
// chooses Woman or Man; they never reach scoring.

import type {
  BestWorstItemV3,
  IntensityItemV3,
  SpecItemV3Pilot,
  UncertaintyItemV3,
} from "@/lib/spec-test/items/spec-v3-pilot";

export const V3_INSTRUMENT_VERSION = "spec-v3.0" as const;

export type SpecItemV3 = SpecItemV3Pilot;
export type { BestWorstItemV3, IntensityItemV3, UncertaintyItemV3 };

export const V3_BEST_WORST_ITEMS: BestWorstItemV3[] = [
  {
    id: "v3-room-presence",
    kind: "best_worst",
    section: "attraction",
    prompt: "At a wedding or house party, who catches your eye?",
    options: [
      { id: "v3-room-presence-a", label: "The {person} making sure nobody feels left out." },
      { id: "v3-room-presence-b", label: "The {person} bringing the energy without doing too much." },
      { id: "v3-room-presence-c", label: "The {person} whose jokes are actually sharp." },
      { id: "v3-room-presence-d", label: "The quiet {person} whose eyes say plenty." },
    ],
  },
  {
    id: "v3-first-plan",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which first-date move would impress you most?",
    options: [
      { id: "v3-first-plan-a", label: "{They} confirms the plan and shows up exactly when {they} said." },
      { id: "v3-first-plan-b", label: "{They} picks a place confidently and makes the whole plan easy." },
      { id: "v3-first-plan-c", label: "{They} adds one fun surprise you did not see coming." },
      { id: "v3-first-plan-d", label: "{They} chooses a spot with immaculate vibes." },
    ],
  },
  {
    id: "v3-feeling-seen",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which move makes you feel properly seen?",
    options: [
      { id: "v3-feeling-seen-a", label: "{They} notices your mood has changed and checks in gently." },
      { id: "v3-feeling-seen-b", label: "{They} remembers one small thing and asks about it later." },
      { id: "v3-feeling-seen-c", label: "{They} gets your strange idea immediately and adds to it." },
      { id: "v3-feeling-seen-d", label: "{They} finds a new experience that fits you perfectly." },
    ],
  },
  {
    id: "v3-quiet-confidence",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which kind of confidence is your weakness?",
    options: [
      { id: "v3-quiet-confidence-a", label: "{They} is lively without begging for attention." },
      { id: "v3-quiet-confidence-b", label: "{They} knows what {they} wants and says it clearly." },
      { id: "v3-quiet-confidence-c", label: "{They} speaks quietly, but every word lands." },
      { id: "v3-quiet-confidence-d", label: "{Their} style looks thoughtful without looking forced." },
    ],
  },
  {
    id: "v3-good-news",
    kind: "best_worst",
    section: "attraction",
    prompt: "You share big news. Which reaction makes you smile hardest?",
    options: [
      { id: "v3-good-news-a", label: "{They} feels the joy with you, not just for you." },
      { id: "v3-good-news-b", label: "{They} celebrates now and still remembers the milestone later." },
      { id: "v3-good-news-c", label: "{They} turns it into a proper celebration immediately." },
      { id: "v3-good-news-d", label: "{They} sees what this win could open up for your future." },
    ],
  },
  {
    id: "v3-weekend-window",
    kind: "best_worst",
    section: "attraction",
    prompt: "A free Saturday appears. Which plan sounds best?",
    options: [
      { id: "v3-weekend-window-a", label: "Good food and gist that keeps getting more interesting." },
      { id: "v3-weekend-window-b", label: "Trying somewhere neither of you has been before." },
      { id: "v3-weekend-window-c", label: "Phones down and one real conversation in private." },
      { id: "v3-weekend-window-d", label: "A beautiful spot with the music and atmosphere just right." },
    ],
  },
  {
    id: "v3-unexpected-change",
    kind: "best_worst",
    section: "attraction",
    prompt: "The plan scatters at the last minute. Who saves the vibe?",
    options: [
      { id: "v3-unexpected-change-a", label: "{They} checks what would still feel good for both of you." },
      { id: "v3-unexpected-change-b", label: "{They} takes charge and picks a new direction." },
      { id: "v3-unexpected-change-c", label: "{They} comes up with a clever Plan B." },
      { id: "v3-unexpected-change-d", label: "{They} turns the detour into a whole new moment." },
    ],
  },
  {
    id: "v3-growing-trust",
    kind: "best_worst",
    section: "attraction",
    prompt: "As you get closer, what keeps the attraction growing?",
    options: [
      { id: "v3-growing-trust-a", label: "{Their} effort stays steady without reminders." },
      { id: "v3-growing-trust-b", label: "{They} keeps familiar moments playful." },
      { id: "v3-growing-trust-c", label: "{They} gives you space and keeps life feeling fresh." },
      { id: "v3-growing-trust-d", label: "{They} slowly lets you into {their} private world." },
    ],
  },
  {
    id: "v3-date-memory",
    kind: "best_worst",
    section: "attraction",
    prompt: "After a really good date, what are you replaying?",
    options: [
      { id: "v3-date-memory-a", label: "How easily {they} noticed the little things you felt." },
      { id: "v3-date-memory-b", label: "How much you laughed and fed off each other's energy." },
      { id: "v3-date-memory-c", label: "The unexpected part that made the night feel different." },
      { id: "v3-date-memory-d", label: "How good {they} looked and how perfect the setting felt." },
    ],
  },
  {
    id: "v3-respect-moment",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which moment makes you respect {them} even more?",
    options: [
      { id: "v3-respect-moment-a", label: "{They} makes a hard decision and owns the outcome." },
      { id: "v3-respect-moment-b", label: "{They} hears a strong point and genuinely changes {their} mind." },
      { id: "v3-respect-moment-c", label: "{They} trusts you with something {they} usually keeps guarded." },
      { id: "v3-respect-moment-d", label: "{They} keeps a promise when breaking it would be easier." },
    ],
  },
  {
    id: "v3-closeness-signal",
    kind: "best_worst",
    section: "attraction",
    prompt: "What makes you think, “Okay, this is becoming real”?",
    options: [
      { id: "v3-closeness-signal-a", label: "You can say what you need without feeling somehow." },
      { id: "v3-closeness-signal-b", label: "{They} becomes more dependable as things get serious." },
      { id: "v3-closeness-signal-c", label: "{They} shares thoughts {they} does not give everybody." },
      { id: "v3-closeness-signal-d", label: "{They} invites you into {their} very particular world." },
    ],
  },
  {
    id: "v3-shared-momentum",
    kind: "best_worst",
    section: "attraction",
    prompt: "Things are getting too predictable. What brings the spark back?",
    options: [
      { id: "v3-shared-momentum-a", label: "A lively night out with obvious flirting." },
      { id: "v3-shared-momentum-b", label: "{They} stops talking about a plan and actually makes it happen." },
      { id: "v3-shared-momentum-c", label: "A conversation that makes you see each other differently." },
      { id: "v3-shared-momentum-d", label: "A new place, class, or experience together." },
    ],
  },
  {
    id: "v3-hard-conversation",
    kind: "best_worst",
    section: "attraction",
    prompt: "Small fight, big feelings. What pulls you closer?",
    options: [
      { id: "v3-hard-conversation-a", label: "{They} stays warm even while disagreeing with you." },
      { id: "v3-hard-conversation-b", label: "{They} says {their} point clearly and helps find a way forward." },
      { id: "v3-hard-conversation-c", label: "{They} gives both of you room to rethink things." },
      { id: "v3-hard-conversation-d", label: "{They} says the deeper feeling behind the first reaction." },
    ],
  },
  {
    id: "v3-easy-afternoon",
    kind: "best_worst",
    section: "attraction",
    prompt: "Nothing serious is planned. What still makes the day sweet?",
    options: [
      { id: "v3-easy-afternoon-a", label: "Both of you naturally carrying your share." },
      { id: "v3-easy-afternoon-b", label: "{Their} playful energy making ordinary things fun." },
      { id: "v3-easy-afternoon-c", label: "The gist wandering everywhere and never getting boring." },
      { id: "v3-easy-afternoon-d", label: "Even the simple choices have taste and atmosphere." },
    ],
  },
  {
    id: "v3-second-look",
    kind: "best_worst",
    section: "attraction",
    prompt: "Who is most likely to get a second look from you?",
    options: [
      { id: "v3-second-look-a", label: "The {person} with a warm smile that feels personal." },
      { id: "v3-second-look-b", label: "The {person} whose lively presence lifts the room." },
      { id: "v3-second-look-c", label: "The {person} who drops one clever comment and leaves you curious." },
      { id: "v3-second-look-d", label: "The composed {person} who clearly has layers." },
    ],
  },
  {
    id: "v3-future-glimpse",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which future sounds most exciting to build together?",
    options: [
      { id: "v3-future-glimpse-a", label: "A partnership where both people show up every day." },
      { id: "v3-future-glimpse-b", label: "A partnership with big goals and a clear direction." },
      { id: "v3-future-glimpse-c", label: "A partnership that keeps opening new doors." },
      { id: "v3-future-glimpse-d", label: "A beautiful private life that feels unmistakably yours." },
    ],
  },
];

const INTENSITY_SCALE = {
  kind: "intensity" as const,
  section: "attraction" as const,
  lowLabel: "Not my thing",
  highLabel: "Exactly my type",
};

export const V3_INTENSITY_ITEMS: IntensityItemV3[] = [
  { ...INTENSITY_SCALE, id: "v3-intensity-warmth", prompt: "How much does a {person} who notices your mood and responds with care pull you in?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-reliability", prompt: "How much does a {person} who keeps {their} word pull you in?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-vitality", prompt: "How much does lively, playful energy pull you in?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-agency", prompt: "How much does a {person} with clear goals and confidence pull you in?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-cognitive", prompt: "How much does a quick mind and excellent banter pull you in?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-novelty", prompt: "How much does spontaneity and a taste for new experiences pull you in?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-depth", prompt: "How much does a quiet {person} with hidden depth pull you in?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-aesthetic", prompt: "How much does strong personal style and good taste pull you in?" },
];

export const V3_UNCERTAINTY_ITEMS: UncertaintyItemV3[] = [
  {
    id: "v3-uncertainty-reply",
    kind: "single_choice",
    section: "uncertainty",
    prompt: "A reply is taking much longer than usual. What do you do first?",
    options: [
      { id: "v3-uncertainty-reply-a", label: "Send one simple check-in instead of guessing." },
      { id: "v3-uncertainty-reply-b", label: "Assume {they} is busy and continue your day." },
      { id: "v3-uncertainty-reply-c", label: "Pull back and give the whole thing space." },
      { id: "v3-uncertainty-reply-d", label: "Want to text again, then stop yourself." },
    ],
  },
  {
    id: "v3-uncertainty-closeness",
    kind: "single_choice",
    section: "uncertainty",
    prompt: "Things are getting serious very fast. What is your instinct?",
    options: [
      { id: "v3-uncertainty-closeness-a", label: "Enjoy it, but check that the pace works for both of you." },
      { id: "v3-uncertainty-closeness-b", label: "Lean in and look for signs {they} feels it too." },
      { id: "v3-uncertainty-closeness-c", label: "Slow it down so you can keep your head clear." },
      { id: "v3-uncertainty-closeness-d", label: "Move closer, then suddenly need some distance." },
    ],
  },
  {
    id: "v3-uncertainty-conflict",
    kind: "single_choice",
    section: "uncertainty",
    prompt: "You have a small disagreement. What is your first move?",
    options: [
      { id: "v3-uncertainty-conflict-a", label: "Name the issue and talk it through calmly." },
      { id: "v3-uncertainty-conflict-b", label: "Try to settle it quickly so you know you are good." },
      { id: "v3-uncertainty-conflict-c", label: "Take private time before returning to it." },
      { id: "v3-uncertainty-conflict-d", label: "Want reassurance, but also feel like withdrawing." },
    ],
  },
  {
    id: "v3-uncertainty-support",
    kind: "single_choice",
    section: "uncertainty",
    prompt: "You have had a rough week and need support. What comes naturally?",
    options: [
      { id: "v3-uncertainty-support-a", label: "Ask clearly for the kind of help you need." },
      { id: "v3-uncertainty-support-b", label: "Reach out often and check that {they} is still there." },
      { id: "v3-uncertainty-support-c", label: "Handle it alone and reconnect when you feel better." },
      { id: "v3-uncertainty-support-d", label: "Want comfort, but struggle to fully depend on it." },
    ],
  },
];

export const SPEC_TEST_ITEMS_V3: SpecItemV3[] = [
  ...V3_BEST_WORST_ITEMS,
  ...V3_INTENSITY_ITEMS,
  ...V3_UNCERTAINTY_ITEMS,
];
