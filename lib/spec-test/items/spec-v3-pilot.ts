// Client-safe v3 pilot bank. It is intentionally not the live instrument: spec-v2.2 stays
// active until these items have passed cognitive interviews and pilot calibration.

export const V3_PILOT_INSTRUMENT_VERSION = "spec-v3-pilot.1" as const;

export type SpecItemOptionV3 = { id: string; label: string };

export type BestWorstItemV3 = {
  id: string;
  kind: "best_worst";
  section: "attraction";
  prompt: string;
  options: [SpecItemOptionV3, SpecItemOptionV3, SpecItemOptionV3, SpecItemOptionV3];
};

export type IntensityItemV3 = {
  id: string;
  kind: "intensity";
  section: "attraction";
  prompt: string;
  lowLabel: string;
  highLabel: string;
};

export type UncertaintyItemV3 = {
  id: string;
  kind: "single_choice";
  section: "uncertainty";
  prompt: string;
  options: [SpecItemOptionV3, SpecItemOptionV3, SpecItemOptionV3, SpecItemOptionV3];
};

export type SpecItemV3Pilot = BestWorstItemV3 | IntensityItemV3 | UncertaintyItemV3;

export const V3_PILOT_BEST_WORST_ITEMS: BestWorstItemV3[] = [
  {
    id: "v3-room-presence",
    kind: "best_worst",
    section: "attraction",
    prompt: "At a gathering, which quality pulls you in most—and which least?",
    options: [
      { id: "v3-room-presence-a", label: "They notice who needs bringing into the conversation." },
      { id: "v3-room-presence-b", label: "Their energy makes an ordinary room feel more alive." },
      { id: "v3-room-presence-c", label: "They turn small talk into a genuinely playful exchange." },
      { id: "v3-room-presence-d", label: "They speak selectively, but their attention feels deep." },
    ],
  },
  {
    id: "v3-first-plan",
    kind: "best_worst",
    section: "attraction",
    prompt: "For a first plan together, which detail matters most—and which least?",
    options: [
      { id: "v3-first-plan-a", label: "They confirm the plan and follow through exactly as promised." },
      { id: "v3-first-plan-b", label: "They make a clear choice and confidently take the lead." },
      { id: "v3-first-plan-c", label: "They add one unexpected idea that neither of you has tried." },
      { id: "v3-first-plan-d", label: "Their choice of place has a distinct, considered sense of style." },
    ],
  },
  {
    id: "v3-feeling-seen",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which kind of attention makes you feel most seen—and which least?",
    options: [
      { id: "v3-feeling-seen-a", label: "They notice a shift in your mood and respond with care." },
      { id: "v3-feeling-seen-b", label: "They remember what matters to you and act on it later." },
      { id: "v3-feeling-seen-c", label: "They catch the idea beneath your words and build on it." },
      { id: "v3-feeling-seen-d", label: "They invite you into an experience outside your usual rhythm." },
    ],
  },
  {
    id: "v3-quiet-confidence",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which expression of confidence is most magnetic—and which least?",
    options: [
      { id: "v3-quiet-confidence-a", label: "They bring expressive, open energy without needing the spotlight." },
      { id: "v3-quiet-confidence-b", label: "They know what they want and communicate it without hesitation." },
      { id: "v3-quiet-confidence-c", label: "They reveal personal depth gradually, without playing games." },
      { id: "v3-quiet-confidence-d", label: "Their choices have a distinctive polish that feels entirely their own." },
    ],
  },
  {
    id: "v3-good-news",
    kind: "best_worst",
    section: "attraction",
    prompt: "You share good news. Which response lands most strongly—and which least?",
    options: [
      { id: "v3-good-news-a", label: "They match your emotion and make the moment feel fully shared." },
      { id: "v3-good-news-b", label: "They celebrate you now and remember the milestone later." },
      { id: "v3-good-news-c", label: "Their excitement is infectious and turns it into a real occasion." },
      { id: "v3-good-news-d", label: "They immediately see what this could open up for your future." },
    ],
  },
  {
    id: "v3-weekend-window",
    kind: "best_worst",
    section: "attraction",
    prompt: "A free weekend opens up. Which instinct attracts you most—and which least?",
    options: [
      { id: "v3-weekend-window-a", label: "They find one idea that gives you both something new to discuss." },
      { id: "v3-weekend-window-b", label: "They suggest leaving the usual routine behind for a while." },
      { id: "v3-weekend-window-c", label: "They create space for a private conversation you rarely get to have." },
      { id: "v3-weekend-window-d", label: "They choose a setting whose atmosphere feels memorable in itself." },
    ],
  },
  {
    id: "v3-unexpected-change",
    kind: "best_worst",
    section: "attraction",
    prompt: "Plans change unexpectedly. Which response is most appealing—and which least?",
    options: [
      { id: "v3-unexpected-change-a", label: "They check what would feel good for both of you now." },
      { id: "v3-unexpected-change-b", label: "They choose a new direction and keep the evening moving." },
      { id: "v3-unexpected-change-c", label: "They make the change interesting by finding a clever alternative." },
      { id: "v3-unexpected-change-d", label: "They turn the detour into something unexpectedly beautiful." },
    ],
  },
  {
    id: "v3-growing-trust",
    kind: "best_worst",
    section: "attraction",
    prompt: "As trust grows, which quality deepens attraction most—and which least?",
    options: [
      { id: "v3-growing-trust-a", label: "Their effort stays steady without needing reminders." },
      { id: "v3-growing-trust-b", label: "Their playful energy keeps familiar moments from feeling flat." },
      { id: "v3-growing-trust-c", label: "They keep making room for separate interests and fresh experiences." },
      { id: "v3-growing-trust-d", label: "They let you see parts of them that are not available to everyone." },
    ],
  },
  {
    id: "v3-date-memory",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which part of a great date stays with you most—and which least?",
    options: [
      { id: "v3-date-memory-a", label: "How naturally they responded to the small things you were feeling." },
      { id: "v3-date-memory-b", label: "How much shared energy there was between you and the world around you." },
      { id: "v3-date-memory-c", label: "The feeling that the night could still go somewhere unexpected." },
      { id: "v3-date-memory-d", label: "The atmosphere, details, and visual impression they created." },
    ],
  },
  {
    id: "v3-respect-moment",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which moment creates the most respect for someone—and which least?",
    options: [
      { id: "v3-respect-moment-a", label: "They make a difficult decision and take responsibility for it." },
      { id: "v3-respect-moment-b", label: "They question an assumption in a way that opens your thinking." },
      { id: "v3-respect-moment-c", label: "They quietly share something meaningful they usually keep private." },
      { id: "v3-respect-moment-d", label: "They keep a promise when it would have been easy not to." },
    ],
  },
  {
    id: "v3-closeness-signal",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which sign of growing closeness matters most—and which least?",
    options: [
      { id: "v3-closeness-signal-a", label: "They make it easy to name what you need without embarrassment." },
      { id: "v3-closeness-signal-b", label: "They become more dependable as the relationship becomes more important." },
      { id: "v3-closeness-signal-c", label: "They trust you with thoughts they do not share casually." },
      { id: "v3-closeness-signal-d", label: "Their private world reveals a strong and particular point of view." },
    ],
  },
  {
    id: "v3-shared-momentum",
    kind: "best_worst",
    section: "attraction",
    prompt: "When life feels repetitive, what restores attraction most—and what least?",
    options: [
      { id: "v3-shared-momentum-a", label: "They bring back movement, laughter, and physical aliveness." },
      { id: "v3-shared-momentum-b", label: "They set a direction and turn a vague wish into a real plan." },
      { id: "v3-shared-momentum-c", label: "They introduce a question that makes you see each other differently." },
      { id: "v3-shared-momentum-d", label: "They suggest exploring a place, skill, or experience together." },
    ],
  },
  {
    id: "v3-hard-conversation",
    kind: "best_worst",
    section: "attraction",
    prompt: "In a hard conversation, which quality draws you closer—and which least?",
    options: [
      { id: "v3-hard-conversation-a", label: "They stay emotionally present even when the topic is uncomfortable." },
      { id: "v3-hard-conversation-b", label: "They state their position clearly and help move toward a decision." },
      { id: "v3-hard-conversation-c", label: "They allow both people room to rethink rather than forcing closure." },
      { id: "v3-hard-conversation-d", label: "They share the deeper feeling beneath their first reaction." },
    ],
  },
  {
    id: "v3-easy-afternoon",
    kind: "best_worst",
    section: "attraction",
    prompt: "On an easy afternoon together, what feels most attractive—and what least?",
    options: [
      { id: "v3-easy-afternoon-a", label: "The comfort of knowing each person will carry their share." },
      { id: "v3-easy-afternoon-b", label: "The lift that comes from their expressive, engaged energy." },
      { id: "v3-easy-afternoon-c", label: "The pleasure of following a conversation wherever it becomes interesting." },
      { id: "v3-easy-afternoon-d", label: "The sense that even simple choices reflect a refined personal taste." },
    ],
  },
  {
    id: "v3-second-look",
    kind: "best_worst",
    section: "attraction",
    prompt: "What is most likely to earn a second look—and what is least likely?",
    options: [
      { id: "v3-second-look-a", label: "A warm expression that makes attention feel personal, not generic." },
      { id: "v3-second-look-b", label: "A lively presence that feels engaged rather than performative." },
      { id: "v3-second-look-c", label: "A quick observation that reveals an original way of thinking." },
      { id: "v3-second-look-d", label: "A composed presence that suggests there is more beneath the surface." },
    ],
  },
  {
    id: "v3-future-glimpse",
    kind: "best_worst",
    section: "attraction",
    prompt: "Which glimpse of a possible future feels most compelling—and which least?",
    options: [
      { id: "v3-future-glimpse-a", label: "A partnership where care is shown consistently in everyday choices." },
      { id: "v3-future-glimpse-b", label: "A partnership with shared direction and room for meaningful ambition." },
      { id: "v3-future-glimpse-c", label: "A partnership that keeps expanding both people's range of experience." },
      { id: "v3-future-glimpse-d", label: "A partnership with a private culture and an unmistakable shared style." },
    ],
  },
];

const INTENSITY_SCALE = {
  kind: "intensity" as const,
  section: "attraction" as const,
  lowLabel: "Not part of the pull",
  highLabel: "Central to the pull",
};

export const V3_PILOT_INTENSITY_ITEMS: IntensityItemV3[] = [
  { ...INTENSITY_SCALE, id: "v3-intensity-warmth", prompt: "How magnetic is emotional attentiveness and responsive care?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-reliability", prompt: "How magnetic is consistent effort and dependable follow-through?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-vitality", prompt: "How magnetic is expressive energy and social aliveness?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-agency", prompt: "How magnetic is clear direction and confident initiative?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-cognitive", prompt: "How magnetic is playful intelligence and a distinctive mind?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-novelty", prompt: "How magnetic is openness to novelty, freedom, and exploration?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-depth", prompt: "How magnetic is private depth that unfolds with trust?" },
  { ...INTENSITY_SCALE, id: "v3-intensity-aesthetic", prompt: "How magnetic is selective taste and a strong aesthetic point of view?" },
];

export const V3_PILOT_UNCERTAINTY_ITEMS: UncertaintyItemV3[] = [
  {
    id: "v3-uncertainty-reply",
    kind: "single_choice",
    section: "uncertainty",
    prompt: "A reply takes much longer than usual. What do you most naturally do first?",
    options: [
      { id: "v3-uncertainty-reply-a", label: "Send a straightforward check-in instead of guessing." },
      { id: "v3-uncertainty-reply-b", label: "Assume there is a reasonable explanation and continue your day." },
      { id: "v3-uncertainty-reply-c", label: "Pull your attention back and give the situation more space." },
      { id: "v3-uncertainty-reply-d", label: "Feel the urge to reach out, then stop yourself and wait." },
    ],
  },
  {
    id: "v3-uncertainty-closeness",
    kind: "single_choice",
    section: "uncertainty",
    prompt: "A new connection becomes close very quickly. What response sounds most like you?",
    options: [
      { id: "v3-uncertainty-closeness-a", label: "Enjoy it while checking that the pace works for both of you." },
      { id: "v3-uncertainty-closeness-b", label: "Lean into the closeness and seek signs that it is mutual." },
      { id: "v3-uncertainty-closeness-c", label: "Slow the pace so you can keep a clear sense of yourself." },
      { id: "v3-uncertainty-closeness-d", label: "Move toward it strongly, then need distance to reset." },
    ],
  },
  {
    id: "v3-uncertainty-conflict",
    kind: "single_choice",
    section: "uncertainty",
    prompt: "Tension appears between you. Which first instinct is closest to yours?",
    options: [
      { id: "v3-uncertainty-conflict-a", label: "Name the issue and work through it without rushing either person." },
      { id: "v3-uncertainty-conflict-b", label: "Try to resolve it quickly so you know the connection is secure." },
      { id: "v3-uncertainty-conflict-c", label: "Take private time before deciding whether to reopen the subject." },
      { id: "v3-uncertainty-conflict-d", label: "Want reassurance immediately but also feel tempted to withdraw." },
    ],
  },
  {
    id: "v3-uncertainty-support",
    kind: "single_choice",
    section: "uncertainty",
    prompt: "You need support during a difficult week. What comes most naturally?",
    options: [
      { id: "v3-uncertainty-support-a", label: "Ask clearly for the kind of support that would help." },
      { id: "v3-uncertainty-support-b", label: "Reach out often and look for signs that they are still there." },
      { id: "v3-uncertainty-support-c", label: "Handle it privately and reconnect once you feel more settled." },
      { id: "v3-uncertainty-support-d", label: "Want comfort but find it difficult to let yourself depend on it." },
    ],
  },
];

export const SPEC_TEST_ITEMS_V3_PILOT: SpecItemV3Pilot[] = [
  ...V3_PILOT_BEST_WORST_ITEMS,
  ...V3_PILOT_INTENSITY_ITEMS,
  ...V3_PILOT_UNCERTAINTY_ITEMS,
];
