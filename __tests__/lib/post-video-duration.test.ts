import { createPostSchema } from "@/lib/validations/post";
import {
  MAX_PREMIUM_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_DURATION_SECONDS,
} from "@/lib/video-upload-constraints";

function postWithVideo(durationSeconds: number, isSubscriberOnly: boolean) {
  return {
    content: "New drop",
    isSubscriberOnly,
    ...(isSubscriberOnly ? { tierId: "tier_1" } : {}),
    mediaItems: [
      {
        url: "https://cdn.example.net/video/playlist.m3u8",
        type: "video" as const,
        durationSeconds,
      },
    ],
  };
}

describe("post video duration rules", () => {
  it("keeps the public feed to short clips", () => {
    expect(createPostSchema.safeParse(postWithVideo(14 * 60, false)).success).toBe(true);

    const tooLong = createPostSchema.safeParse(postWithVideo(42 * 60, false));
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(tooLong.error.issues[0]?.message).toContain("published as Premium");
    }
  });

  it("lets a premium post run for hours", () => {
    expect(createPostSchema.safeParse(postWithVideo(3 * 60 * 60, true)).success).toBe(true);
    expect(
      createPostSchema.safeParse(postWithVideo(MAX_PREMIUM_VIDEO_DURATION_SECONDS, true)).success,
    ).toBe(true);
  });

  it("still caps premium somewhere", () => {
    const past = createPostSchema.safeParse(
      postWithVideo(MAX_PREMIUM_VIDEO_DURATION_SECONDS + 30 * 60, true),
    );
    expect(past.success).toBe(false);
  });

  it("does not reject a post over the second or two a transcoder rounds by", () => {
    expect(
      createPostSchema.safeParse(postWithVideo(MAX_VIDEO_DURATION_SECONDS + 2, false)).success,
    ).toBe(true);
    expect(
      createPostSchema.safeParse(
        postWithVideo(MAX_PREMIUM_VIDEO_DURATION_SECONDS + 2, true),
      ).success,
    ).toBe(true);
  });

  it("leaves images and unmeasured video alone", () => {
    const withImage = createPostSchema.safeParse({
      content: "photo",
      isSubscriberOnly: false,
      mediaItems: [{ url: "https://cdn.example.net/photo.jpg", type: "image" as const }],
    });
    expect(withImage.success).toBe(true);

    // Bunny could not report a length; the post is not blocked on that alone.
    const unmeasured = createPostSchema.safeParse({
      content: "clip",
      isSubscriberOnly: false,
      mediaItems: [{ url: "https://cdn.example.net/v/playlist.m3u8", type: "video" as const }],
    });
    expect(unmeasured.success).toBe(true);
  });
});
