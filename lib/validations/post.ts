import { z } from "zod";

import { EVENT_TYPE_OPTIONS } from "@/lib/events";
import { MAX_POST_MEDIA_ITEMS, POST_DISPLAY_ASPECT_RATIOS, POST_MEDIA_TYPES } from "@/lib/post-shared";

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

export const feedEventSchema = z
  .object({
    title: z.string().min(3, "Event title must be at least 3 characters").max(120),
    eventType: z.enum(EVENT_TYPE_OPTIONS),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    venueName: z.string().min(1, "Venue is required").max(150),
    address: z.string().max(300).default(""),
    city: z.string().max(100).default(""),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    maxAttendees: z.number().int().min(1).max(100000).nullable().default(null),
    priceCents: z.number().int().min(0).max(100000000).default(0),
    isPrivate: z.boolean().default(false),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const createPostSchema = z
  .object({
    content: z.string().max(2000, "Posts must be 2000 characters or fewer"),
    mediaUrls: z.array(z.string().url()).max(MAX_POST_MEDIA_ITEMS).optional(),
    mediaItems: z.array(postMediaItemSchema).max(MAX_POST_MEDIA_ITEMS, `Up to ${MAX_POST_MEDIA_ITEMS} media items per post`).optional(),
    isSubscriberOnly: z.boolean(),
    postType: z.enum(["standard", "event", "live"]).default("standard"),
    event: feedEventSchema.optional(),
  })
  .refine((data) => data.postType !== "event" || Boolean(data.event), {
    message: "Add event details before publishing",
    path: ["event"],
  })
  .refine((data) => {
    const mediaCount = data.mediaItems?.length ?? data.mediaUrls?.length ?? 0;
    return data.content.trim().length > 0 || mediaCount > 0 || data.postType === "event";
  }, {
    message: "Write something or add an image",
    path: ["content"],
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("archive"),
  }),
  z.object({
    action: z.literal("edit"),
    content: z.string().trim().min(1, "Post can't be empty").max(2000, "Posts must be 2000 characters or fewer"),
    isSubscriberOnly: z.boolean().optional(),
  }),
]);

export type UpdatePostInput = z.infer<typeof updatePostSchema>;
