import { archetypeSummary, likeSummaryPrompt, personWordFor } from "@/lib/spec-test/archetype-labels";

describe("personWordFor", () => {
  it("resolves male to 'man' and female to 'woman'", () => {
    expect(personWordFor("male")).toBe("man");
    expect(personWordFor("female")).toBe("woman");
  });

  it("falls back to 'woman' (the same default the result page uses) for a missing target", () => {
    expect(personWordFor(null)).toBe("woman");
    expect(personWordFor(undefined)).toBe("woman");
  });
});

describe("likeSummaryPrompt", () => {
  it("prefixes the summary as who this spec is drawn to, lowercasing the first letter", () => {
    const summary = archetypeSummary("beautiful_mystery")!;
    expect(likeSummaryPrompt(summary, "male")).toBe(
      "I like a man who is stylish, selective, and a little hard to read. Reveals themselves gradually, with layers worth discovering rather than everything upfront.",
    );
  });

  it("switches the gendered word for a female target", () => {
    const summary = archetypeSummary("grounded_equal")!;
    expect(likeSummaryPrompt(summary, "female")).toBe(
      "I like a woman who is dependable, values-driven, and comfortable being themselves. Prioritizes real compatibility and consistency over grand gestures.",
    );
  });
});
