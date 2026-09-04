jest.mock("@/lib/prisma", () => ({
  prisma: {
    providerSubscription: { findMany: jest.fn() },
    subscription: { findMany: jest.fn() },
  },
}));

import {
  getCreatorAccess,
  resolvePostAccess,
  type CreatorAccessInfo,
} from "@/lib/subscription-access";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  providerSubscription: { findMany: jest.Mock };
  subscription: { findMany: jest.Mock };
};

describe("getCreatorAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an empty map when there's no viewer", async () => {
    const access = await getCreatorAccess(null, ["creator-1"]);
    expect(access.size).toBe(0);
    expect(mockPrisma.providerSubscription.findMany).not.toHaveBeenCalled();
  });

  it("returns an empty map when there are no creators to check", async () => {
    const access = await getCreatorAccess("viewer-1", []);
    expect(access.size).toBe(0);
    expect(mockPrisma.providerSubscription.findMany).not.toHaveBeenCalled();
  });

  it("takes the highest tier price across ProviderSubscription and the legacy Subscription table", async () => {
    mockPrisma.providerSubscription.findMany.mockResolvedValue([
      { providerId: "creator-1", tier: { priceCents: 500_000 } },
    ]);
    mockPrisma.subscription.findMany.mockResolvedValue([
      { creatorId: "creator-1", tier: { priceCents: 1_500_000 } },
    ]);

    const access = await getCreatorAccess("viewer-1", ["creator-1"]);

    expect(access.get("creator-1")).toEqual<CreatorAccessInfo>({
      maxTierPriceCents: 1_500_000,
      hasAnySub: true,
    });
  });

  it("only ever queries active, unexpired subscriptions — this is what makes a subscription stop granting access the instant it passes one month", async () => {
    mockPrisma.providerSubscription.findMany.mockResolvedValue([]);
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    await getCreatorAccess("viewer-1", ["creator-1"]);

    const providerWhere = mockPrisma.providerSubscription.findMany.mock.calls[0][0].where;
    const legacyWhere = mockPrisma.subscription.findMany.mock.calls[0][0].where;
    expect(providerWhere.status).toBe("active");
    expect(providerWhere.endsAt.gt).toBeInstanceOf(Date);
    expect(legacyWhere.status).toBe("active");
    expect(legacyWhere.endsAt.gt).toBeInstanceOf(Date);
  });
});

describe("resolvePostAccess", () => {
  it("never locks a free post", () => {
    const result = resolvePostAccess(
      { authorId: "creator-1", isSubscriberOnly: false, tier: null },
      new Map(),
      "viewer-1",
    );
    expect(result).toEqual({ unlocked: true, requiredTier: null });
  });

  it("always unlocks the post's own author, regardless of subscription state", () => {
    const result = resolvePostAccess(
      {
        authorId: "creator-1",
        isSubscriberOnly: true,
        tier: { id: "tier-1", name: "Inner Circle", priceCents: 1_500_000 },
      },
      new Map(),
      "creator-1",
    );
    expect(result).toEqual({ unlocked: true, requiredTier: null });
  });

  it("locks a premium post from a creator the viewer has no subscription to", () => {
    const result = resolvePostAccess(
      {
        authorId: "creator-1",
        isSubscriberOnly: true,
        tier: { id: "tier-1", name: "Beginner", priceCents: 750_000 },
      },
      new Map(),
      "viewer-1",
    );
    expect(result).toEqual({
      unlocked: false,
      requiredTier: { id: "tier-1", name: "Beginner", priceCents: 750_000 },
    });
  });

  it("unlocks a post priced at exactly the viewer's tier", () => {
    const access = new Map<string, CreatorAccessInfo>([
      ["creator-1", { maxTierPriceCents: 1_050_000, hasAnySub: true }],
    ]);
    const result = resolvePostAccess(
      {
        authorId: "creator-1",
        isSubscriberOnly: true,
        tier: { id: "tier-premium", name: "Premium", priceCents: 1_050_000 },
      },
      access,
      "viewer-1",
    );
    expect(result.unlocked).toBe(true);
  });

  it("a higher tier unlocks a cheaper post from the same creator", () => {
    const access = new Map<string, CreatorAccessInfo>([
      ["creator-1", { maxTierPriceCents: 1_500_000, hasAnySub: true }], // Inner Circle
    ]);
    const result = resolvePostAccess(
      {
        authorId: "creator-1",
        isSubscriberOnly: true,
        tier: { id: "tier-beginner", name: "Beginner", priceCents: 750_000 },
      },
      access,
      "viewer-1",
    );
    expect(result.unlocked).toBe(true);
  });

  it("a lower tier does NOT unlock a more expensive post from the same creator", () => {
    const access = new Map<string, CreatorAccessInfo>([
      ["creator-1", { maxTierPriceCents: 750_000, hasAnySub: true }], // Beginner
    ]);
    const result = resolvePostAccess(
      {
        authorId: "creator-1",
        isSubscriberOnly: true,
        tier: { id: "tier-inner-circle", name: "Inner Circle", priceCents: 1_500_000 },
      },
      access,
      "viewer-1",
    );
    expect(result).toEqual({
      unlocked: false,
      requiredTier: { id: "tier-inner-circle", name: "Inner Circle", priceCents: 1_500_000 },
    });
  });

  it("falls back to 'any active subscription unlocks it' for a premium post with no tier assigned", () => {
    const subscribed = new Map<string, CreatorAccessInfo>([
      ["creator-1", { maxTierPriceCents: 750_000, hasAnySub: true }],
    ]);
    const unsubscribed = new Map<string, CreatorAccessInfo>();

    expect(
      resolvePostAccess({ authorId: "creator-1", isSubscriberOnly: true, tier: null }, subscribed, "viewer-1")
        .unlocked,
    ).toBe(true);
    expect(
      resolvePostAccess({ authorId: "creator-1", isSubscriberOnly: true, tier: null }, unsubscribed, "viewer-1")
        .unlocked,
    ).toBe(false);
  });
});

describe("feed vs. profile locked-post behavior", () => {
  const access = new Map<string, CreatorAccessInfo>([
    ["creator-1", { maxTierPriceCents: 750_000, hasAnySub: true }], // subscribed at Beginner only
  ]);
  const posts = [
    { id: "post-beginner", authorId: "creator-1", isSubscriberOnly: true, tier: { id: "t1", name: "Beginner", priceCents: 750_000 } },
    { id: "post-inner-circle", authorId: "creator-1", isSubscriberOnly: true, tier: { id: "t2", name: "Inner Circle", priceCents: 1_500_000 } },
  ];

  it("the Premium feed keeps only posts the viewer's tier actually covers, dropping the rest entirely", () => {
    const feedPosts = posts.filter((post) => resolvePostAccess(post, access, "viewer-1").unlocked);
    expect(feedPosts.map((p) => p.id)).toEqual(["post-beginner"]);
  });

  it("a creator's own profile keeps every premium post but marks the above-tier one locked, naming its tier", () => {
    // Mirrors toPostView in lib/posts.ts: requiredTier is only surfaced once a post is
    // actually locked, never alongside a post the viewer can already see.
    const profilePosts = posts.map((post) => {
      const { unlocked, requiredTier } = resolvePostAccess(post, access, "viewer-1");
      return { id: post.id, unlocked, requiredTier: unlocked ? null : requiredTier };
    });
    expect(profilePosts).toEqual([
      { id: "post-beginner", unlocked: true, requiredTier: null },
      {
        id: "post-inner-circle",
        unlocked: false,
        requiredTier: { id: "t2", name: "Inner Circle", priceCents: 1_500_000 },
      },
    ]);
  });
});
