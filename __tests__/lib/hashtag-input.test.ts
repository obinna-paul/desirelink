import { getActiveHashtag, replaceActiveHashtag } from "@/lib/hashtag-input";

describe("getActiveHashtag", () => {
  it("finds a bare hashtag and a partially typed hashtag at the caret", () => {
    expect(getActiveHashtag("Hello #", 7)).toEqual({ query: "", start: 6, end: 7 });
    expect(getActiveHashtag("Hello #Lago", 11)).toEqual({ query: "lago", start: 6, end: 11 });
  });

  it("supports African-language characters and punctuation boundaries", () => {
    expect(getActiveHashtag("Culture: #Ọdị", 13)).toEqual({ query: "ọdị", start: 9, end: 13 });
  });

  it("does not activate a completed hashtag when the caret has moved on", () => {
    expect(getActiveHashtag("Hello #lagos today", 18)).toBeNull();
  });
});

describe("replaceActiveHashtag", () => {
  it("replaces only the active fragment and returns the new caret", () => {
    const active = getActiveHashtag("At #lag tonight", 7);
    expect(active).not.toBeNull();
    expect(replaceActiveHashtag("At #lag tonight", active!, "LagosNightlife")).toEqual({
      value: "At #lagosnightlife tonight",
      caret: 18,
    });
  });
});
