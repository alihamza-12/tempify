import { z } from "zod";

const modificationOptions = [
  "alloy-wheels",
  "wheel-size",
  "performance-tyres",
  "run-flat-conversion",
  "roof-racks",
  "window-tints",
  "custom-plates",
] as const;

export const createQuoteSchema = z.object({
  registration: z.string().trim().min(2).max(10),
  cover: z.object({
    durationUnit: z.enum(["hours", "days", "weeks"]),
    durationValue: z.coerce.number().int().min(1).max(28),
    startAt: z.string().datetime(),
  }),
  driver: z.object({
    title: z.enum(["Mr", "Mrs", "Miss", "Ms", "Mx"]),
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    dateOfBirth: z.string().date(),
    occupation: z.string().trim().min(2).max(100),
    phone: z.string().trim().regex(/^[+0-9 ()-]{7,24}$/),
    email: z.string().trim().toLowerCase().email().max(254),
  }),
  address: z.object({
    line1: z.string().trim().min(3).max(120),
    line2: z.string().trim().max(120).optional().default(""),
    city: z.string().trim().min(2).max(80),
    postcode: z.string().trim().min(5).max(10),
  }),
  licence: z.object({
    number: z.string().trim().min(8).max(24),
    type: z.enum(["Full UK", "Provisional UK", "International", "Full EU"]),
    heldFor: z.enum(["Under 1 Year", "1-2 Years", "2-4 Years", "5-10 Years", "10+ Years"]),
    vehicleValue: z.enum([
      "£1,000 - £5,000",
      "£5,000 - £10,000",
      "£10,000 - £20,000",
      "£20,000 - £30,000",
      "£30,000 - £50,000",
      "£50,000 - £80,000",
      "£80,000+",
    ]),
    reasonForCover: z.enum(["Borrowing", "Buying/Selling/Testing", "Learning", "Maintenance", "Other"]),
  }),
  modifications: z.array(z.enum(modificationOptions)).max(modificationOptions.length).default([]),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
