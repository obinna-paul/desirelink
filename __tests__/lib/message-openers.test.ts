import {
  getMessageOpenerCategoriesForProfile,
  MESSAGE_OPENER_CATEGORIES,
  shuffleMessageOpeners,
} from "@/lib/message-openers";

describe("message opener library", () => {
  it("ships at least 60 distinct one-line openers in every category", () => {
    for (const category of MESSAGE_OPENER_CATEGORIES) {
      expect(category.openers.length).toBeGreaterThanOrEqual(60);
      expect(new Set(category.openers.map((opener) => opener.toLowerCase().trim())).size).toBe(
        category.openers.length,
      );
      for (const opener of category.openers) {
        expect(opener.trim()).toBe(opener);
        expect(opener).not.toMatch(/[\r\n]/);
        expect(opener.length).toBeGreaterThan(10);
        expect(opener.length).toBeLessThanOrEqual(180);
      }
    }
  });

  it("replaces Creator/Fan with extra fun categories for Seekers", () => {
    const seekerIds = getMessageOpenerCategoriesForProfile("SEEKER").map((category) => category.value);
    expect(seekerIds).not.toContain("creator_fan");
    expect(seekerIds).toEqual(expect.arrayContaining(["would_you_rather", "hot_take", "quick_game", "date_energy"]));

    const explorerIds = getMessageOpenerCategoriesForProfile("EXPLORER").map((category) => category.value);
    expect(explorerIds).toContain("creator_fan");
    expect(explorerIds).not.toContain("would_you_rather");
  });

  it("starts a rebuilt shuffle bag with a different line from the one just shown", () => {
    const deck = shuffleMessageOpeners(["first", "second", "third"], "third", () => 0.999);
    expect(deck.at(-1)).not.toBe("third");
    expect(new Set(deck)).toEqual(new Set(["first", "second", "third"]));
  });
});
