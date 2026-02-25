import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80, "Name is too long"),
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[a-z]/, "Password must include at least one lowercase letter")
    .regex(/[0-9]/, "Password must include at least one number"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});
