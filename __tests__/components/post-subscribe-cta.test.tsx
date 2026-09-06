import { render, screen } from "@testing-library/react";

import { PostSubscribeCta } from "@/components/posts/post-subscribe-cta";
import type { PostSubscribePrompt } from "@/lib/posts";

const prompt: PostSubscribePrompt = {
  providerId: "creator-1",
  providerUsername: "amara",
  tiers: [
    {
      id: "tier-1",
      name: "Premium",
      description: "Subscriber posts",
      priceCents: 500_000,
      tierType: "standard",
      isLimited: false,
      maxSubscribers: null,
      subscriberCount: 8,
      viewerState: "available",
    },
  ],
};

describe("PostSubscribeCta", () => {
  it("renders a clear full-size subscription action instead of a metadata chip", () => {
    render(<PostSubscribeCta prompt={prompt} creatorName="Amara Okafor" />);

    expect(screen.getByText("Get more from @amara")).toBeInTheDocument();
    expect(
      screen.getByText("Unlock premium posts and support Amara Okafor's work."),
    ).toBeInTheDocument();

    const subscribeButton = screen.getByRole("button", { name: /Subscribe/i });
    expect(subscribeButton).toHaveClass("h-11", "w-full", "rounded-[8px]");
    expect(subscribeButton).not.toHaveClass("rounded-full");
  });
});
