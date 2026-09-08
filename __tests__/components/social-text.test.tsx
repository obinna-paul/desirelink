import { render, screen } from "@testing-library/react";

import { SocialText } from "@/components/posts/social-text";

describe("SocialText", () => {
  it("links mentions and hashtags while leaving email addresses as text", () => {
    render(<SocialText content="Meet @amara.paul at #Lagos. hello@example.com" />);

    expect(screen.getByRole("link", { name: "@amara.paul" })).toHaveAttribute("href", "/profile/amara.paul");
    expect(screen.getByRole("link", { name: "#Lagos" })).toHaveAttribute("href", "/hashtag/lagos");
    expect(screen.queryByRole("link", { name: /example/i })).not.toBeInTheDocument();
  });

  it("does not link partial overlong handles or hashtags", () => {
    render(
      <SocialText
        content={`@${"a".repeat(21)} #${"b".repeat(51)}`}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
