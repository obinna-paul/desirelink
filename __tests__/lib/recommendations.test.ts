import { scoreDesireOverlap } from "@/lib/recommendation-scoring";

describe("scoreDesireOverlap", () => {
  it("weights looking and regular desire overlap heavily", () => {
    const result = scoreDesireOverlap(
      [
        { category: "Dinner", level: "looking" },
        { category: "Events", level: "regular" },
      ],
      [
        { category: "Dinner", level: "regular" },
        { category: "Events", level: "interested" },
      ]
    );

    expect(result.score).toBe(44);
    expect(result.reasons[0]).toContain("aligns strongly");
  });

  it("penalizes hard-limit conflicts and clamps below zero", () => {
    const result = scoreDesireOverlap(
      [{ category: "Smoking", level: "hard_limit" }],
      [{ category: "Smoking", level: "regular" }]
    );

    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });
});
