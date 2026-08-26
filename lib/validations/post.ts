import { z } from "zod";

import { MAX_POST_IMAGES } from "@/lib/post-shared";

export const createPostSchema = z
  .object({
    content: z.string().max(2000, "Posts must be 2000 characters or fewer"),
    mediaUrls: z.array(z.string().url()).max(MAX_POST_IMAGES, "Up to 4 images per post"),
    isSubscriberOnly: z.boolean(),
  })
  .refine((data) => data.content.trim().length > 0 || data.mediaUrls.length > 0, {
    message: "Write something or add an image",
    path: ["content"],
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;
