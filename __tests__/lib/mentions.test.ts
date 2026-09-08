import {
  extractMentionUsernames,
  getActiveMention,
  replaceActiveMention,
} from "@/lib/mentions";

describe("mentions", () => {
  it("extracts unique normalized usernames without treating email addresses as mentions", () => {
    expect(
      extractMentionUsernames("Thanks @Amara_7 and @obinna.paul. Email me at hello@example.com. @amara_7"),
    ).toEqual(["amara_7", "obinna.paul"]);
  });

  it("does not extract a partial username from an overlong token", () => {
    expect(extractMentionUsernames("Hello @this_username_is_far_too_long today")).toEqual([]);
  });

  it("finds the mention fragment at the caret", () => {
    expect(getActiveMention("Hello @ama.pa", 13)).toEqual({
      query: "ama.pa",
      start: 6,
      end: 13,
    });
    expect(getActiveMention("hello@example", 13)).toBeNull();
  });

  it("replaces a mention fragment and leaves the caret after a separating space", () => {
    const active = getActiveMention("Hello @ama.pa there", 13);
    expect(active).not.toBeNull();
    expect(replaceActiveMention("Hello @ama.pa there", active!, "Amara_7")).toEqual({
      value: "Hello @amara_7 there",
      caret: 14,
    });
  });
});
