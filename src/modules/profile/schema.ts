import { z } from "zod";

const titleCase = (value: string) =>
  value.replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) =>
    `${prefix}${letter.toUpperCase()}`,
  );

export const customerProfileSchema = z.object({
  title: z.enum(["Mr", "Mrs", "Miss", "Ms", "Mx"]),
  firstName: z.string().trim().min(2).max(60).transform(titleCase),
  lastName: z.string().trim().min(2).max(60).transform(titleCase),
  email: z.string().trim().toLowerCase().email().max(254),
  dateOfBirth: z.string().date(),
  gender: z.enum(["Male", "Female", "Other", "Prefer not to say"]),
  occupation: z.string().trim().min(2).max(100).transform(titleCase),
  phone: z.string().trim().regex(/^\d{7,15}$/, "Enter 7 to 15 digits."),
  drivingLicenceNumber: z.string().trim().min(8).max(24).transform((value) => value.toUpperCase()),
  licenceType: z.enum(["Full UK", "Provisional UK", "International", "Full EU"]),
  licenceHeldFor: z.enum(["Under 1 Year", "1-2 Years", "2-4 Years", "5-10 Years", "10+ Years"]),
  lastFourDigits: z.union([
    z.literal(""),
    z.string().regex(/^\d{4}$/, "Enter exactly four digits."),
  ]),
  address: z.object({
    line1: z.string().trim().min(3).max(120).transform(titleCase),
    line2: z.string().trim().max(120).transform(titleCase),
    city: z.string().trim().min(2).max(80).transform(titleCase),
    county: z.string().trim().max(80).transform(titleCase),
    postcode: z.string().trim().min(5).max(10).transform((value) => value.toUpperCase()),
    country: z.literal("GB").default("GB"),
  }),
});

export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;
