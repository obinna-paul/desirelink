import { z } from "zod";

import { USERNAME_PATTERN } from "@/lib/username";

export const ACCOUNT_TYPE_VALUES = ["EXPLORER", "CREATOR", "PAIR", "SERVICE_PROVIDER"] as const;

export const usernameFieldSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "3-20 characters: lowercase letters, numbers, underscores only");

export const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50),
    username: usernameFieldSchema,
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    profileType: z.enum(ACCOUNT_TYPE_VALUES).default("EXPLORER"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.input<typeof signupSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
