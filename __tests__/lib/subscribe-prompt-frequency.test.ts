import {
  MAX_SUBSCRIBE_PROMPTS_PER_FEED,
  selectSubscribePromptPostIds,
} from "@/lib/subscribe-prompt-frequency";

function post(
  id: string,
  creatorId: string,
  overrides: Partial<{ isFree: boolean; isEligible: boolean }> = {},
) {
  return {
    id,
    creatorId,
    isFree: true,
    isEligible: true,
    ...overrides,
  };
}

describe("subscription prompt frequency", () => {
  it("shows at most one prompt per creator", () => {
    const selected = selectSubscribePromptPostIds([
      post("post-1", "creator-1"),
      post("post-2", "creator-1"),
      post("post-3", "creator-1"),
      post("post-4", "creator-1"),
    ]);

    expect(Array.from(selected)).toEqual(["post-1"]);
  });

  it("leaves two visible free posts between prompts and caps the feed total", () => {
    const selected = selectSubscribePromptPostIds(
      Array.from({ length: 12 }, (_, index) =>
        post(`post-${index + 1}`, `creator-${index + 1}`),
      ),
    );

    expect(Array.from(selected)).toEqual(["post-1", "post-4", "post-7"]);
    expect(selected.size).toBe(MAX_SUBSCRIBE_PROMPTS_PER_FEED);
  });

  it("does not count hidden premium posts as spacing in For You", () => {
    const selected = selectSubscribePromptPostIds([
      post("post-1", "creator-1"),
      post("premium-1", "creator-2", { isFree: false }),
      post("post-2", "creator-2"),
      post("post-3", "creator-3"),
      post("post-4", "creator-4"),
    ]);

    expect(Array.from(selected)).toEqual(["post-1", "post-4"]);
  });
});
