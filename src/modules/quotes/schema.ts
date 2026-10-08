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

function capitalizeWords(value: string) {
  return value.replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
}

export const createQuoteSchema = z.object({
  registration: z.string().trim().min(2).max(10),
  cover: z.object({
    durationUnit: z.enum(["hours", "days", "weeks"]),
    durationValue: z.coerce.number().int().min(1).max(28),
    startAt: z.string().datetime("Choose a valid start date and time."),
  }),
  driver: z.object({
    title: z.enum(["Mr", "Mrs", "Miss", "Ms", "Mx"]),
    firstName: z.string().trim().min(2, "Enter a valid first name.").max(60).transform(capitalizeWords),
    lastName: z.string().trim().min(2, "Enter a valid last name.").max(60).transform(capitalizeWords),
    dateOfBirth: z.string().date(),
    occupation: z.string().trim().min(2, "Enter a valid occupation.").max(100).transform(capitalizeWords),
    phone: z.string().trim().regex(/^[0-9]{7,15}$/, "Enter a valid phone number using 7 to 15 digits only."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  }),
  address: z.object({
    line1: z.string().trim().min(3, "Enter a valid address.").max(120).transform(capitalizeWords),
    line2: z.string().trim().max(120).optional().default("").transform(capitalizeWords),
    city: z.string().trim().min(2, "Enter a valid city or town.").max(80).transform(capitalizeWords),
    postcode: z.string().trim().min(5, "Enter a valid postcode.").max(10).transform((value) => value.toUpperCase()),
  }),
  licence: z.object({
    number: z.string().trim().min(8, "Enter a valid driving licence number.").max(24).transform((value) => value.toUpperCase()),
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
