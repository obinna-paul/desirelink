const mockGetServerSession = jest.fn();
const mockProfileFindUnique = jest.fn();
const mockTierFindUnique = jest.fn();
const mockPostCreate = jest.fn();
const mockSafeParse = jest.fn();
const mockGetPostByIdForViewer = jest.fn();
const mockGetBunnyVideoId = jest.fn();
const mockGetBunnyVideoState = jest.fn();
const mockClassifyBunnyVideoState = jest.fn();

jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findUnique: (...args: unknown[]) => mockProfileFindUnique(...args) },
    creatorTier: { findUnique: (...args: unknown[]) => mockTierFindUnique(...args) },
    post: { create: (...args: unknown[]) => mockPostCreate(...args) },
  },
}));
jest.mock("@/lib/validations/post", () => ({
  createPostSchema: { safeParse: (...args: unknown[]) => mockSafeParse(...args) },
}));
jest.mock("@/lib/provider-types", () => ({ isProviderProfileType: jest.fn(() => true) }));
jest.mock("@/lib/verification", () => ({ hasIdentityOnFile: jest.fn(async () => true) }));
jest.mock("@/lib/moderation", () => ({ flagContentIfNeeded: jest.fn(async () => undefined) }));
jest.mock("@/lib/hashtags", () => ({ syncPostHashtags: jest.fn(async () => undefined) }));
jest.mock("@/lib/search", () => ({ syncPostSearchDocument: jest.fn(async () => undefined) }));
jest.mock("@/lib/mention-notifications", () => ({
  notifyMentionedProfiles: jest.fn(async () => undefined),
}));
jest.mock("@/lib/posts", () => ({
  getPostByIdForViewer: (...args: unknown[]) => mockGetPostByIdForViewer(...args),
}));
jest.mock("@/lib/bunny-stream", () => ({
  getBunnyVideoIdFromPlaybackUrl: (...args: unknown[]) => mockGetBunnyVideoId(...args),
  getBunnyVideoUploadState: (...args: unknown[]) => mockGetBunnyVideoState(...args),
  classifyBunnyVideoUploadState: (...args: unknown[]) => mockClassifyBunnyVideoState(...args),
}));

import { POST } from "@/app/api/posts/route";

const BUNNY_URL =
  "https://videos.example.test/cd54b416-fa26-44fe-b794-db1bbb474514/playlist.m3u8";

function postRequest() {
  return new Request("http://localhost/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

function parsedPost(mediaItems: Array<{ url: string; type: "image" | "video" }>) {
  return {
    success: true,
    data: {
      content: "A post",
      mediaItems,
      isSubscriberOnly: true,
      lockedPreviewMode: "hidden",
      tierId: "tier-1",
      postType: "standard",
    },
  };
}

describe("POST /api/posts - Bunny playback readiness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockProfileFindUnique.mockResolvedValue({
      id: "creator-1",
      username: "creator",
      displayName: "Creator",
      avatarUrl: null,
      isSuspended: false,
      profileType: "PROVIDER",
    });
    mockTierFindUnique.mockResolvedValue({ creatorId: "creator-1" });
    mockPostCreate.mockResolvedValue({
      id: "post-1",
      content: "A post",
      mediaUrls: [],
      postType: "standard",
      isSubscriberOnly: true,
      createdAt: new Date("2026-09-18T00:00:00.000Z"),
    });
    mockGetPostByIdForViewer.mockResolvedValue({ id: "post-1" });
    mockGetBunnyVideoId.mockReturnValue("cd54b416-fa26-44fe-b794-db1bbb474514");
    mockGetBunnyVideoState.mockResolvedValue({ status: 7 });
  });

  it("refuses to publish a premium video that Bunny has not made playable", async () => {
    mockSafeParse.mockReturnValue(parsedPost([{ url: BUNNY_URL, type: "video" }]));
    mockClassifyBunnyVideoState.mockReturnValue("processing");

    const response = await POST(postRequest());

    expect(response).toMatchObject({
      status: 409,
      body: { code: "VIDEO_NOT_READY" },
    });
    expect(mockPostCreate).not.toHaveBeenCalled();
  });

  it("publishes normally as soon as the premium video has a playable rendition", async () => {
    mockSafeParse.mockReturnValue(parsedPost([{ url: BUNNY_URL, type: "video" }]));
    mockClassifyBunnyVideoState.mockReturnValue("playable");

    const response = await POST(postRequest());

    expect(response).toMatchObject({ status: 201, body: { post: { id: "post-1" } } });
    expect(mockGetBunnyVideoState).toHaveBeenCalledWith(
      "cd54b416-fa26-44fe-b794-db1bbb474514",
    );
    expect(mockPostCreate).toHaveBeenCalledTimes(1);
  });

  it("does not add Bunny checks to image posts", async () => {
    mockSafeParse.mockReturnValue(
      parsedPost([{ url: "https://images.example.test/photo.jpg", type: "image" }]),
    );

    const response = await POST(postRequest());

    expect(response).toMatchObject({ status: 201 });
    expect(mockGetBunnyVideoId).not.toHaveBeenCalled();
    expect(mockGetBunnyVideoState).not.toHaveBeenCalled();
    expect(mockPostCreate).toHaveBeenCalledTimes(1);
  });

  it("does not interfere with videos hosted outside this Bunny library", async () => {
    mockSafeParse.mockReturnValue(
      parsedPost([{ url: "https://media.example.test/video.mp4", type: "video" }]),
    );
    mockGetBunnyVideoId.mockReturnValue(null);

    const response = await POST(postRequest());

    expect(response).toMatchObject({ status: 201 });
    expect(mockGetBunnyVideoState).not.toHaveBeenCalled();
    expect(mockPostCreate).toHaveBeenCalledTimes(1);
  });
});
