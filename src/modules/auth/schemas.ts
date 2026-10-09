import { z } from "zod";

function capitalizeWords(value: string) {
  return value.replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

export const requestOtpSchema = z.object({
  firstName: z.string().trim().min(2).max(50).transform(capitalizeWords),
  lastName: z.string().trim().min(2).max(50).transform(capitalizeWords),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(72)
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[0-9]/, "Include a number"),
  acceptedTerms: z.literal(true),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().regex(/^\d{6}$/),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});
