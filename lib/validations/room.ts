import { z } from "zod";

export const roomFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().max(2000),
  isPrivate: z.boolean(),
  coverImageUrl: z.string(),
});

export type RoomFormInput = z.infer<typeof roomFormSchema>;
