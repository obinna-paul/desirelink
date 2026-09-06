import { act, render, screen } from "@testing-library/react";

import { PostCard } from "@/components/posts/post-card";
import type { PostView } from "@/lib/posts";

jest.mock("@/components/posts/comments-sheet", () => ({ CommentsSheet: () => null }));
jest.mock("@/components/posts/post-actions", () => ({ PostActions: () => null }));
jest.mock("@/components/posts/post-caption", () => ({ PostCaption: () => null }));
jest.mock("@/components/posts/post-detail-modal", () => ({ PostDetailModal: () => null }));
jest.mock("@/components/posts/post-media-carousel", () => ({ PostMediaCarousel: () => null }));
jest.mock("@/components/posts/post-owner-controls", () => ({ PostOwnerControls: () => null }));
jest.mock("@/components/posts/post-subscribe-cta", () => ({ PostSubscribeCta: () => null }));
jest.mock("@/components/profile/subscribe-plans-dialog", () => ({ SubscribePlansDialog: () => null }));
jest.mock("@/components/profile/verification-badge", () => ({ VerificationBadge: () => null }));
jest.mock("@/components/safety/report-dialog", () => ({ ReportDialog: () => null }));
jest.mock("@/lib/client-session", () => ({ getClientSessionId: () => "session-1" }));
jest.mock("@/components/ui/presence-avatar", () => ({
  PresenceRing: ({ children }: { children: React.ReactNode }) => children,
  getPresenceDestination: ({
    username,
    status,
    activeStreamId,
  }: {
    username: string;
    status: string;
    activeStreamId: string | null;
  }) =>
    status === "live" && activeStreamId
      ? `/live/${activeStreamId}`
      : `/profile/${username}`,
}));

const post: PostView = {
  id: "post-1",
  content: null,
  mediaUrls: [],
  mediaItems: [],
  postType: "standard",
  isSubscriberOnly: false,
  locked: false,
  lockReason: null,
  requiredTier: null,
  blurredPreview: null,
  subscribePrompt: null,
  viewCount: 3,
  isPinned: false,
  createdAt: new Date().toISOString(),
  author: {
    id: "creator-1",
    username: "amara",
    displayName: "Amara",
    avatarUrl: "",
    profileType: "CREATOR",
    presenceStatus: "offline",
    activeStreamId: null,
    isVerified: true,
    isVerifiedCreator: true,
    isVerifiedServiceProvider: false,
    verificationPending: false,
  },
  counts: { comments: 0, reactions: 0, shares: 0 },
  viewerLiked: false,
  viewerSaved: false,
  viewerCanManage: false,
  viewerCanEdit: false,
  comments: [],
};

describe("PostCard view tracking", () => {
  let intersectionCallback: IntersectionObserverCallback;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }
      observe = jest.fn();
      disconnect = jest.fn();
      unobserve = jest.fn();
      takeRecords = jest.fn(() => []);
      root = null;
      rootMargin = "0px";
      thresholds = [0, 0.5, 1];
    }

    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
    fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ counted: true, count: 4 }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it("counts after a one-second visible dwell and displays the server count", async () => {
    render(<PostCard post={post} />);

    act(() => {
      intersectionCallback(
        [{ isIntersecting: true, intersectionRatio: 0.75 } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/posts/post-1/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        surface: "unknown",
        position: undefined,
        dwellMs: 1_000,
        sessionId: "session-1",
      }),
    });
    expect(screen.getByText("4 views")).toBeInTheDocument();
  });
});
