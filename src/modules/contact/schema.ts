import { z } from "zod";

export const contactMessageSchema = z.object({
  firstName: z.string().trim().min(2, "Enter your first name.").max(60),
  lastName: z.string().trim().min(2, "Enter your last name.").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  subject: z.string().trim().min(3, "Enter a subject.").max(120),
  message: z.string().trim().min(10, "Enter at least 10 characters in your message.").max(3000),
  challengeToken: z.string().min(20).max(1000),
  challengeAnswer: z.coerce.number().int().min(0).max(100),
  acceptedPrivacy: z.boolean().refine((value) => value, "You must accept the privacy notice."),
  website: z.string().max(200).optional().default(""),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
