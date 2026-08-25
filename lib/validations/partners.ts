import { z } from "zod";

export const sendPartnerInviteSchema = z.object({
  username: z.string().min(1, "Enter a username"),
});

export const respondPartnerInviteSchema = z.object({
  action: z.enum(["accept", "decline", "cancel"]),
});
