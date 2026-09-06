import {
  feedMediaAspectRatio,
  isPostDisplayAspectRatio,
  POST_DISPLAY_RATIO_OPTIONS,
} from "@/lib/post-shared";
import { postMediaItemSchema } from "@/lib/validations/post";

describe("post media aspect ratios", () => {
  it("supports landscape media from validation through feed layout", () => {
    const media = {
      url: "https://video.example.test/video/playlist.m3u8",
      type: "video" as const,
      displayAspectRatio: "landscape_16_9" as const,
    };

    expect(postMediaItemSchema.safeParse(media).success).toBe(true);
    expect(isPostDisplayAspectRatio(media.displayAspectRatio)).toBe(true);
    expect(feedMediaAspectRatio(media)).toBe(16 / 9);
    expect(POST_DISPLAY_RATIO_OPTIONS).toContainEqual(
      expect.objectContaining({ value: "landscape_16_9", helper: "16:9" }),
    );
  });

  it("rejects unsupported frame names", () => {
    expect(isPostDisplayAspectRatio("cinema_21_9")).toBe(false);
  });
});
