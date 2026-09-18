import { getLockedPostPreview, toMediaItems } from "@/lib/posts";
import { createPostSchema } from "@/lib/validations/post";

const cloudinaryImage = {
  url: "https://res.cloudinary.com/demo/image/upload/v1/private/photo.jpg",
  type: "image" as const,
};

describe("locked post previews", () => {
  it("defaults new and legacy posts to fully hidden", () => {
    const parsed = createPostSchema.parse({
      content: "Premium photo",
      mediaItems: [cloudinaryImage],
      isSubscriberOnly: true,
    });

    expect(parsed.lockedPreviewMode).toBe("hidden");
    expect(toMediaItems([cloudinaryImage])[0]?.lockedPreviewMode).toBeUndefined();
    expect(getLockedPostPreview([cloudinaryImage], "hidden")).toBeNull();
  });

  it("only creates a safe transformed thumbnail after an explicit opt-in", () => {
    const preview = getLockedPostPreview([cloudinaryImage], "blurred");

    expect(preview).toEqual(
      expect.objectContaining({ cssBlur: false }),
    );
    expect(preview?.url).toContain("/image/upload/e_blur:2000,q_auto,w_400/");
    expect(preview?.url).not.toBe(cloudinaryImage.url);
  });

  it("preserves a stored preview choice when reading media", () => {
    expect(
      toMediaItems([{ ...cloudinaryImage, lockedPreviewMode: "blurred" }])[0]
        ?.lockedPreviewMode,
    ).toBe("blurred");
  });

  it("rejects unknown preview modes", () => {
    const result = createPostSchema.safeParse({
      content: "Premium photo",
      mediaItems: [cloudinaryImage],
      isSubscriberOnly: true,
      lockedPreviewMode: "unblurred",
    });

    expect(result.success).toBe(false);
  });
});
