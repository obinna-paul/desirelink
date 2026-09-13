// Question prompts and option labels only - no scoring weights. This file has no
// "server-only" guard because the quiz wizard (a client component) needs to render
// these; the weights that turn answers into a result live in lib/spec-test.ts, which
// stays server-only. See docs/spec-test-quiz.md for the full question bank source.

export type SpecTestOptionKey = "A" | "B" | "C" | "D";

export type SpecTestQuestionPublic = {
  id: string;
  prompt: string;
  options: Record<SpecTestOptionKey, string>;
};

export const SPEC_TEST_QUESTIONS: SpecTestQuestionPublic[] = [
  {
    id: "rooftop-party",
    prompt: "You arrive at a rooftop party. Who do you notice first?",
    options: {
      A: "The person making everyone laugh",
      B: "The person quietly watching everything",
      C: "The person who seems to know everybody",
      D: "The person helping the host sort something out",
    },
  },
  {
    id: "movie-chemistry",
    prompt: "Which movie moment creates the most chemistry?",
    options: {
      A: "Two people teasing each other while cooking",
      B: "A long look across a crowded room",
      C: "A perfectly dressed couple making an entrance",
      D: "A vulnerable conversation at 2 a.m.",
    },
  },
  {
    id: "someone-likes-you",
    prompt: "Someone likes you. Which move is most likely to work?",
    options: {
      A: "They confidently ask you out",
      B: "They remember an insignificant detail you mentioned",
      C: "They send something that makes you laugh unexpectedly",
      D: "They give you space but remain consistent",
    },
  },
  {
    id: "late-night-message",
    prompt: "Which late-night message would tempt you most?",
    options: {
      A: "“I’m downstairs. Come out.”",
      B: "A thoughtful three-minute voice note",
      C: "A meme that only the two of you would understand",
      D: "“I made reservations. Be ready at eight tomorrow.”",
    },
  },
  {
    id: "couples-sunday",
    prompt: "Pick the couple’s Sunday you would secretly want.",
    options: {
      A: "Brunch, an event, and meeting people",
      B: "Phones off, food ordered, and nowhere to go",
      C: "An unplanned trip outside the city",
      D: "Working toward a shared goal together",
    },
  },
  {
    id: "compliment",
    prompt: "Which compliment stays with you longest?",
    options: {
      A: "“You look incredible.”",
      B: "“I feel peaceful around you.”",
      C: "“The way your mind works is attractive.”",
      D: "“There’s something about your energy.”",
    },
  },
  {
    id: "instant-turnoff",
    prompt: "Which flaw can instantly ruin attraction?",
    options: {
      A: "Neediness",
      B: "Arrogance",
      C: "Predictability",
      D: "Lack of ambition",
    },
  },
  {
    id: "weekend-home",
    prompt: "Choose a home for one unforgettable weekend.",
    options: {
      A: "A polished penthouse overlooking the city",
      B: "A quiet cabin surrounded by trees",
      C: "A colourful apartment in the centre of everything",
      D: "A secluded beach house with no neighbours",
    },
  },
  {
    id: "disagreement",
    prompt: "Someone attractive disagrees with you. What makes it hotter rather than annoying?",
    options: {
      A: "They calmly defend their position",
      B: "They turn it into playful banter",
      C: "They genuinely try to understand you",
      D: "They confidently challenge your assumptions",
    },
  },
  {
    id: "remember-first",
    prompt: "What do you usually remember first about someone?",
    options: {
      A: "Their face and clothes",
      B: "Their voice and manner of speaking",
      C: "How they moved and occupied the room",
      D: "How they made you feel",
    },
  },
];
