jest.mock("@/lib/prisma", () => ({ prisma: {} }));

import { postHashtagAffinity } from "@/lib/hashtag-affinity";

describe("postHashtagAffinity", () => {
  it("returns zero when the viewer has no signal for a post's tags", () => {
    expect(postHashtagAffinity(["lagos"], new Map())).toBe(0);
  });

  it("averages matching positive and negative behavioral signals", () => {
    const affinity = new Map([
      ["lagos", 6],
      ["nightlife", -2],
    ]);
    expect(postHashtagAffinity(["Lagos", "nightlife", "fashion"], affinity)).toBe(2);
  });
});
