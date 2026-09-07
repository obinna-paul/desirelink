import { render, screen } from "@testing-library/react";

import { PostOverflowMenu } from "@/components/posts/post-overflow-menu";

describe("PostOverflowMenu", () => {
  it("left-aligns every action, including a wrapped hide-creator label", () => {
    render(<PostOverflowMenu postId="post-1" creatorId="creator-1" />);

    for (const name of [
      "Save",
      "Interested",
      "Not interested",
      "Hide posts from this creator",
      "Report post",
    ]) {
      expect(screen.getByRole("button", { name })).toHaveClass("justify-start", "text-left");
    }

    expect(screen.getByText("Hide posts from this creator")).toHaveClass("flex-1", "text-left");
  });
});
