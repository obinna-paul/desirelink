import { z } from "zod";

import { EVENT_TYPE_OPTIONS } from "@/lib/events";

export const eventFormSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(120),
    description: z.string().max(3000),
    eventType: z.enum(EVENT_TYPE_OPTIONS),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    venueName: z.string().min(1, "Venue name is required").max(150),
    address: z.string().max(300),
    city: z.string().max(100),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    maxAttendees: z.number().int().min(1).max(100000).nullable(),
    priceCents: z.number().int().min(0).max(100000000),
    isPrivate: z.boolean(),
    coverImageUrl: z.string(),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export type EventFormInput = z.infer<typeof eventFormSchema>;
