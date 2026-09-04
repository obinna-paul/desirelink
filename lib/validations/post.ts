import { z } from "zod";

import {
  MAX_POST_MEDIA_ITEMS,
  POST_DISPLAY_ASPECT_RATIOS,
  POST_MEDIA_TYPES,
} from "@/lib/post-shared";

const postMediaCropSchema = z.object({
  zoom: z.number().min(1).max(3),
  offsetXFrac: z.number(),
  offsetYFrac: z.number(),
});

export const postMediaItemSchema = z.object({
  // Accepts both an absolute Cloudinary URL and the root-relative path returned by the
  // local-storage upload fallback (lib/uploads.ts) - both are valid next/image src values.
  url: z.string().min(1),
  type: z.enum(POST_MEDIA_TYPES),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  displayAspectRatio: z.enum(POST_DISPLAY_ASPECT_RATIOS).optional(),
  crop: postMediaCropSchema.optional(),
});

export const createPostSchema = z
  .object({
    content: z.string().max(2000, "Posts must be 2000 characters or fewer"),
    mediaUrls: z.array(z.string().url()).max(MAX_POST_MEDIA_ITEMS).optional(),
    mediaItems: z
      .array(postMediaItemSchema)
      .max(
        MAX_POST_MEDIA_ITEMS,
        `Up to ${MAX_POST_MEDIA_ITEMS} media items per post`,
      )
      .optional(),
    isSubscriberOnly: z.boolean(),
    tierId: z.string().min(1).optional(),
    postType: z.enum(["standard", "live"]).default("standard"),
  })
  .refine(
    (data) => {
      const mediaCount = data.mediaItems?.length ?? data.mediaUrls?.length ?? 0;
      return data.content.trim().length > 0 || mediaCount > 0;
    },
    {
      message: "Write something or add an image",
      path: ["content"],
    },
  );

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("archive"),
  }),
  z.object({
    action: z.literal("edit"),
    content: z
      .string()
      .trim()
      .min(1, "Post can't be empty")
      .max(2000, "Posts must be 2000 characters or fewer"),
    isSubscriberOnly: z.boolean().optional(),
    tierId: z.string().min(1).nullable().optional(),
  }),
  z.object({
    action: z.literal("pin"),
  }),
  z.object({
    action: z.literal("unpin"),
  }),
]);

export type UpdatePostInput = z.infer<typeof updatePostSchema>;
